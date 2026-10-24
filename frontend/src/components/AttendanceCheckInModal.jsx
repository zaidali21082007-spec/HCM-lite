import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import Modal from './Modal';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Camera, MapPin, CheckCircle2, AlertTriangle, RefreshCw, XCircle, Info } from 'lucide-react';

const DETECT_INTERVAL_MS = 300;
const VERIFY_FRAMES = 2;
const LOSE_FRAMES = 5;
const HINT_AFTER_MS = 3000;
const MAX_ACCURACY_M = 100;

export default function AttendanceCheckInModal({ isOpen, onClose, onAttendanceRecorded }) {
  const { isEmployee } = useAuth();
  const { showToast } = useNotification();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const activeRef = useRef(false);
  const okStreakRef = useRef(0);
  const missStreakRef = useRef(0);
  const verifiedRef = useRef(false);
  const noFaceSinceRef = useRef(null);

  const [modelReady, setModelReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [faceCount, setFaceCount] = useState(0);
  const [verified, setVerified] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [coords, setCoords] = useState(null);
  const [geoState, setGeoState] = useState('idle');
  const [geoError, setGeoError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverResult, setServerResult] = useState(null);
  const [serverError, setServerError] = useState(null);

  function stopAll() {
    activeRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function locate(highAccuracy = true) {
    if (!navigator.geolocation) {
      setGeoState('error');
      setGeoError('This browser does not support location.');
      return;
    }
    setGeoState('locating');
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGeoState('ok');
      },
      (err) => {
        if (highAccuracy) {
          locate(false);
          return;
        }
        setGeoState('error');
        setGeoError(
          err.code === 1
            ? 'Location permission is blocked. Allow location for this site, then press Retry.'
            : 'Could not get your location. Move near a window or outside, then press Retry.'
        );
      },
      { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15000 : 25000, maximumAge: 60000 }
    );
  }

  function updateStability(n) {
    const now = Date.now();
    if (n === 1) {
      okStreakRef.current += 1;
      missStreakRef.current = 0;
      noFaceSinceRef.current = null;
      if (okStreakRef.current >= VERIFY_FRAMES) verifiedRef.current = true;
    } else {
      okStreakRef.current = 0;
      if (n >= 2) {
        verifiedRef.current = false;
        missStreakRef.current = 0;
      } else {
        missStreakRef.current += 1;
        if (missStreakRef.current >= LOSE_FRAMES) verifiedRef.current = false;
      }
      if (n === 0 && noFaceSinceRef.current === null) noFaceSinceRef.current = now;
    }
    const hint = n === 0 && noFaceSinceRef.current !== null && now - noFaceSinceRef.current > HINT_AFTER_MS;
    setFaceCount(n);
    setVerified(verifiedRef.current);
    setShowHint(hint);
  }

  function drawBoxes(dets, video) {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 4;
    ctx.strokeStyle = dets.length === 1 ? '#10b981' : '#f59e0b';
    dets.forEach((d) => {
      const b = d.box;
      ctx.strokeRect(b.x, b.y, b.width, b.height);
    });
  }

  // Session: camera, face model, and GPS when the modal opens
  useEffect(() => {
    if (!isOpen || !isEmployee) return;
    let cancelled = false;

    setModelReady(false);
    setCameraReady(false);
    setInitError(null);
    setFaceCount(0);
    setVerified(false);
    setShowHint(false);
    setServerResult(null);
    setServerError(null);
    setCoords(null);
    okStreakRef.current = 0;
    missStreakRef.current = 0;
    verifiedRef.current = false;
    noFaceSinceRef.current = null;
    locate(true);

    (async () => {
      try {
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
          await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        }
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          faceapi.nets.tinyFaceDetector.loadFromUri('/models').catch((e) =>
            console.warn('Fallback detector unavailable:', e)
          );
        }
        if (!cancelled) setModelReady(true);
      } catch (err) {
        console.error('Face model failed to load:', err);
        if (!cancelled) setInitError('Face model failed to load. Check that frontend/public/models exists.');
      }
    })();

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        if (!cancelled) setCameraReady(true);
      } catch (err) {
        console.error('Camera error:', err);
        if (!cancelled) setInitError(`Camera unavailable: ${err.message}. Allow camera access and reopen.`);
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [isOpen, isEmployee]);

  // Detection loop: starts only when the model and camera are both ready
  useEffect(() => {
    if (!isOpen || !modelReady || !cameraReady) return;
    activeRef.current = true;

    const detect = async (video) => {
      const ssd = await faceapi.detectAllFaces(
        video,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
      );
      if (ssd.length > 0 || !faceapi.nets.tinyFaceDetector.isLoaded) return ssd;
      return faceapi.detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 })
      );
    };

    const tick = async () => {
      if (!activeRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const dets = await detect(video);
          if (!activeRef.current) return;
          updateStability(dets.length);
          drawBoxes(dets, video);
          console.log(`faces=${dets.length} video=${video.videoWidth}x${video.videoHeight}`);
        } catch (err) {
          console.error('Detection error:', err);
        }
      }
      if (activeRef.current) {
        timerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
      }
    };

    tick();

    return () => {
      activeRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, modelReady, cameraReady]);

  async function handleCheckIn() {
    if (!verified) {
      showToast('Face not verified yet. Look straight at the camera.', 'error');
      return;
    }
    if (!coords) {
      showToast('Location is not available yet.', 'error');
      return;
    }
    setSubmitting(true);
    setServerError(null);
    setServerResult(null);
    try {
      const res = await api.checkIn({
        source: 'camera',
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy: coords.accuracy,
      });
      setServerResult(res);
      showToast(`Check-in recorded: ${res.status || res.attendance?.status}`, 'success');
      onAttendanceRecorded && onAttendanceRecorded();
      stopAll();
    } catch (err) {
      setServerError(err.message || 'Check-in was rejected');
      showToast(err.message || 'Check-in rejected', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    stopAll();
    onClose();
  }

  if (!isOpen || !isEmployee) return null;

  const geoOk = geoState === 'ok' && coords && coords.accuracy <= MAX_ACCURACY_M;
  const canCheckIn = verified && geoOk && !submitting && !serverResult;

  let badge;
  if (!modelReady || !cameraReady) {
    badge = { text: 'Loading camera and face model...', color: '#334155', Icon: RefreshCw };
  } else if (verified) {
    badge = { text: 'FACE VERIFIED', color: '#10b981', Icon: CheckCircle2 };
  } else if (faceCount >= 2) {
    badge = { text: `${faceCount} FACES - ONLY YOU SHOULD BE IN FRAME`, color: '#f59e0b', Icon: AlertTriangle };
  } else if (faceCount === 1) {
    badge = { text: 'HOLD STILL...', color: '#f59e0b', Icon: RefreshCw };
  } else {
    badge = { text: 'NO FACE - LOOK AT THE CAMERA', color: '#ef4444', Icon: AlertTriangle };
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Face-Recognition Attendance Check-In" maxWidth={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Look straight at the camera with your whole face visible. Hold still for one second, then check in.</span>
        </div>

        {initError && (
          <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', padding: 12, borderRadius: 10, fontSize: '0.825rem', color: 'var(--danger)' }}>
            {initError}
          </div>
        )}

        <div style={{ position: 'relative', width: '100%', height: 260, background: '#000', borderRadius: 12, overflow: 'hidden' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', pointerEvents: 'none' }}
          />
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
            {!initError && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, background: badge.color, color: '#fff' }}>
                <badge.Icon size={14} /> {badge.text}
              </span>
            )}
          </div>
        </div>

        {showHint && (
          <div style={{ fontSize: '0.8rem', color: 'var(--warning, #f59e0b)', textAlign: 'center' }}>
            Face the camera straight on, bring your whole face and forehead into frame, and keep light in front of you, not behind.
          </div>
        )}

        <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 10, border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color="var(--primary)" /> GPS Location
            </span>
            {coords && (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: coords.accuracy <= MAX_ACCURACY_M ? 'var(--success)' : 'var(--danger)' }}>
                Accuracy: {coords.accuracy}m{coords.accuracy > MAX_ACCURACY_M ? ' (must be 100m or less)' : ''}
              </span>
            )}
          </div>
          {geoState === 'ok' && coords ? (
            <div style={{ display: 'flex', gap: 16, color: 'var(--text-secondary)' }}>
              <div>Lat: <code>{coords.lat.toFixed(5)}</code></div>
              <div>Lng: <code>{coords.lng.toFixed(5)}</code></div>
            </div>
          ) : geoState === 'error' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'var(--danger)' }}>
              <span>{geoError}</span>
              <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => locate(true)}>
                Retry
              </button>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Getting your location...</div>
          )}
        </div>

        {serverResult && (
          <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} /> Attendance recorded: {serverResult.status || serverResult.attendance?.status}
            </div>
            {serverResult.distanceMeters != null && (
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                Distance from office: <strong>{serverResult.distanceMeters}m</strong>
              </div>
            )}
          </div>
        )}

        {serverError && (
          <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' }}>
              <XCircle size={16} /> Check-in rejected
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 4 }}>{serverError}</div>
          </div>
        )}

        <button
          onClick={handleCheckIn}
          disabled={!canCheckIn}
          className="btn btn-primary"
          style={{ padding: 14, fontSize: '0.95rem', width: '100%' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {submitting ? <RefreshCw size={16} /> : <Camera size={16} />}
            {submitting ? 'Recording attendance...' : 'Check In with Face & GPS'}
          </span>
        </button>
        {!canCheckIn && !serverResult && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: -6 }}>
            {!verified ? 'Waiting for a verified face...' : 'Waiting for an accurate GPS fix (100m or better)...'}
          </div>
        )}

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
          Live face detection required. No images are sent to the server. The server stamps the time and checks the 100m accuracy and office geofence.
        </p>
      </div>
    </Modal>
  );
}
