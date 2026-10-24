const aiService = require('../services/ai.service');

async function chat(req, res, next) {
  try {
    const { prompt, conversationHistory } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    const result = await aiService.processUserPrompt({
      prompt,
      conversationHistory,
      user: req.user,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function smartLeave(req, res, next) {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, message: 'Sentence prompt is required' });
    }

    const prefill = await aiService.parseSmartLeavePrompt(prompt, req.user);
    res.json({ success: true, prefill });
  } catch (err) {
    next(err);
  }
}

async function dashboardSummary(req, res, next) {
  try {
    const { kpiData } = req.body;
    const summary = await aiService.generateDashboardSummary(kpiData || {}, req.user);
    res.json({ success: true, ...summary });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  chat,
  smartLeave,
  dashboardSummary,
};
