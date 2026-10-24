/**
 * Date and Attendance / Leave utility functions
 */

const getDayName = (date) => {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
};

const normalizeDateOnly = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

const formatDateYMD = (date) => {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns list of working days between startDate and endDate (inclusive).
 * Skips weekend days and holidays.
 */
const getWorkingDaysBetween = (startDate, endDate, weekendDaysList = ['Saturday', 'Sunday'], holidayDates = []) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) return { count: 0, dates: [] };

  const holidaysSet = new Set(
    holidayDates.map((h) => (typeof h === 'string' ? h.substring(0, 10) : formatDateYMD(h)))
  );

  const weekendSet = new Set(weekendDaysList.map((w) => w.trim().toLowerCase()));

  const workingDates = [];
  const current = new Date(start);

  while (current <= end) {
    const dayName = getDayName(current).toLowerCase();
    const ymd = formatDateYMD(current);

    const isWeekend = weekendSet.has(dayName);
    const isHoliday = holidaysSet.has(ymd);

    if (!isWeekend && !isHoliday) {
      workingDates.push(new Date(current));
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    count: workingDates.length,
    dates: workingDates,
  };
};

/**
 * Total working days in a given year and month (1-indexed month, e.g. 10 for October)
 */
const getWorkingDaysInMonth = (year, month, weekendDaysList = ['Saturday', 'Sunday'], holidayDates = []) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // last day of month
  return getWorkingDaysBetween(start, end, weekendDaysList, holidayDates);
};

/**
 * Check if check-in time is late
 * officeStartTime: "09:00"
 * graceMinutes: 15 -> Late after 09:15
 */
const isTimeLate = (checkInDate, officeStartTime = '09:00', graceMinutes = 15) => {
  const checkIn = new Date(checkInDate);
  const [startHour, startMinute] = officeStartTime.split(':').map(Number);

  // Late threshold time on that day
  const threshold = new Date(checkIn);
  threshold.setHours(startHour, startMinute + graceMinutes, 0, 0);

  return checkIn.getTime() > threshold.getTime();
};

/**
 * Calculate distance in meters between two lat/lng coordinates (Haversine formula)
 */
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

module.exports = {
  getDayName,
  normalizeDateOnly,
  formatDateYMD,
  getWorkingDaysBetween,
  getWorkingDaysInMonth,
  isTimeLate,
  calculateDistanceMeters,
};
