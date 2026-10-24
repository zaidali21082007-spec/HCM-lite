const { getToolsForUser, executeTool } = require('../ai/toolRegistry');
const prisma = require('../config/prisma');
const { ROLES } = require('../config/constants');

// In-memory hourly rate limiting map: userId -> [timestamp1, timestamp2, ...]
const userRequestTimestamps = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const limit = 20; // 20 requests per user per hour

  let timestamps = userRequestTimestamps.get(userId) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    const error = new Error('AI assistant rate limit reached (20 requests per hour). Please try again later.');
    error.statusCode = 429;
    throw error;
  }

  timestamps.push(now);
  userRequestTimestamps.set(userId, timestamps);
}

// Log every AI interaction in ai_logs table
async function recordAiLog({ userId, userEmail, userRole, prompt, toolCalled, toolResult, response }) {
  try {
    await prisma.aiLog.create({
      data: {
        userId,
        userEmail,
        userRole,
        prompt,
        toolCalled: toolCalled || null,
        toolResult: toolResult ? JSON.stringify(toolResult).substring(0, 2000) : null,
        response: response ? response.substring(0, 4000) : '',
      },
    });
  } catch (err) {
    console.error('Failed to write to ai_logs:', err);
  }
}

/**
 * Check for colleague salary refusal guardrail
 */
function checkForColleagueSalaryViolation(prompt, user) {
  if (user.role === ROLES.EMPLOYEE) {
    const p = prompt.toLowerCase();
    const salaryKeywords = [
      'salary',
      'pay',
      'paid',
      'earn',
      'earns',
      'earning',
      'earnings',
      'compensation',
      'wage',
      'wages',
      'package',
      'remuneration',
      'make',
      'makes',
    ];
    const asksSalary = salaryKeywords.some((kw) => p.includes(kw));
    const isAskingAboutSelf =
      p.includes('my salary') ||
      p.includes('my pay') ||
      p.includes('my payslip') ||
      p.includes('my compensation') ||
      p.includes('my earnings') ||
      p.includes('my wage') ||
      p.includes('my net') ||
      p.includes('i earn') ||
      p.includes('i make');

    if (asksSalary && !isAskingAboutSelf) {
      return "I cannot disclose salary or compensation information for other colleagues. Company security policy strictly restricts compensation details to personal self-service only.";
    }
  }
  return null;
}

async function processUserPrompt({ prompt, conversationHistory = [], user }) {
  checkRateLimit(user.id);

  // 1. Check Colleague-salary refusal guardrail
  const refusalMessage = checkForColleagueSalaryViolation(prompt, user);
  if (refusalMessage) {
    await recordAiLog({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      prompt,
      response: refusalMessage,
    });
    return {
      reply: refusalMessage,
      isAiGenerated: true,
      label: 'AI-generated',
    };
  }

  const apiKey = process.env.AI_API_KEY;
  const userTools = getToolsForUser(user);

  let result = null;

  // 2. Real Tool Calling via hosted LLM with 15s timeout
  if (apiKey && apiKey.trim().length > 10) {
    try {
      result = await callHostedLlmWithTools({ prompt, user, apiKey, tools: userTools });
    } catch (err) {
      console.warn('Hosted LLM API call timed out or failed, using service tool fallback:', err.message);
      // Fallback to service layer tool executor
      result = await executeLocalAssistant({ prompt, user, tools: userTools });
    }
  } else {
    // Deterministic fallback calling identical service layer
    result = await executeLocalAssistant({ prompt, user, tools: userTools });
  }

  // 3. Log to ai_logs
  await recordAiLog({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    prompt,
    toolCalled: result.toolUsed || null,
    toolResult: result.toolResult || null,
    response: result.reply,
  });

  return {
    ...result,
    isAiGenerated: true,
    label: 'AI-generated',
  };
}

/**
 * Hosted LLM calling with Google Gemini API or OpenAI API format and 15s timeout
 */
async function callHostedLlmWithTools({ prompt, user, apiKey, tools }) {
  const isGemini = apiKey.startsWith('AIza') || process.env.AI_PROVIDER === 'gemini';
  if (isGemini) {
    return await callGeminiApi({ prompt, user, apiKey, tools });
  } else {
    return await callOpenAiApi({ prompt, user, apiKey, tools });
  }
}

async function callGeminiApi({ prompt, user, apiKey, tools }) {
  const model = process.env.AI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const functionDeclarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'OBJECT',
      properties: t.parameters.properties || {},
      required: t.parameters.required || [],
    },
  }));

  const systemInstruction = `You are HCM Lite AI, an intelligent HR assistant.
User: ${user.email} (Role: ${user.role}).
Company rules: Office starts 09:00, grace 15 min (late after 09:15), half day under 5 hours, weekend Sat-Sun. Quotas: annual 14, sick 8, casual 10, unpaid unlimited. Gross = 1.5x basic.
Never disclose colleague salary to employees.
Always use tools to fetch live data from the database.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ functionDeclarations }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part?.functionCall) {
      const { name, args } = part.functionCall;
      const toolResult = await executeTool(name, args, user);

      // Follow-up for synthesis
      const followUpRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: prompt }] },
            { role: 'model', parts: [{ functionCall: part.functionCall }] },
            {
              role: 'user',
              parts: [{ functionResponse: { name, response: { output: toolResult } } }],
            },
          ],
          tools: [{ functionDeclarations }],
        }),
      });

      if (followUpRes.ok) {
        const followUpData = await followUpRes.json();
        const text = followUpData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { reply: text, toolUsed: name, toolResult };
        }
      }

      return {
        reply: `Result from **${name}**:\n\n\`\`\`json\n${JSON.stringify(toolResult, null, 2)}\n\`\`\``,
        toolUsed: name,
        toolResult,
      };
    }

    return { reply: part?.text || 'No text output.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAiApi({ prompt, user, apiKey, tools }) {
  const openAiTools = tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 s timeout

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are HCM Lite AI. User: ${user.email} (${user.role}). Refuse colleague salary requests. Rules: Office starts 09:00, grace 15m, half day < 5h, annual 14, sick 8, casual 10. Always invoke tools.`,
          },
          { role: 'user', content: prompt },
        ],
        tools: openAiTools,
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;

    if (choice?.tool_calls?.length > 0) {
      const call = choice.tool_calls[0];
      const name = call.function.name;
      const args = JSON.parse(call.function.arguments || '{}');
      const toolResult = await executeTool(name, args, user);

      return {
        reply: `Here are the results retrieved via **${name}**:\n\n` + JSON.stringify(toolResult, null, 2),
        toolUsed: name,
        toolResult,
      };
    }

    return { reply: choice?.content || 'No response.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Smart Leave JSON pre-fill parser
 * Converts natural language phrases (e.g. "Need next Monday and Tuesday off for a wedding")
 * into JSON: { leaveTypeId, leaveTypeCode, startDate, endDate, reason }
 */
async function parseSmartLeavePrompt(textPrompt, user) {
  checkRateLimit(user.id);
  const leaveTypes = await prisma.leaveType.findMany();

  // Extract reason
  let reason = 'Personal leave';
  const forMatch = textPrompt.match(/for\s+(.*)/i);
  if (forMatch && forMatch[1]) {
    reason = forMatch[1].trim();
  }

  // Determine type (wedding/personal -> CASUAL; illness/doctor -> SICK; holiday/vacation -> ANNUAL)
  const p = textPrompt.toLowerCase();
  let selectedCode = 'CASUAL';
  if (p.includes('sick') || p.includes('doctor') || p.includes('hospital') || p.includes('fever') || p.includes('medical')) {
    selectedCode = 'SICK';
  } else if (p.includes('annual') || p.includes('vacation') || p.includes('trip') || p.includes('holiday')) {
    selectedCode = 'ANNUAL';
  } else if (p.includes('unpaid') || p.includes('without pay')) {
    selectedCode = 'UNPAID';
  }

  const matchingType = leaveTypes.find((t) => t.code === selectedCode) || leaveTypes[0];

  // Calculate dates relative to today
  const today = new Date();
  let start = new Date(today);
  let end = new Date(today);

  if (p.includes('next monday')) {
    const daysUntilNextMon = ((1 + 7 - today.getDay()) % 7) || 7;
    start.setDate(today.getDate() + daysUntilNextMon);
    end.setDate(today.getDate() + daysUntilNextMon);

    if (p.includes('tuesday')) {
      end.setDate(start.getDate() + 1);
    } else if (p.includes('wednesday')) {
      end.setDate(start.getDate() + 2);
    } else if (p.includes('friday')) {
      end.setDate(start.getDate() + 4);
    }
  } else if (p.includes('tomorrow')) {
    start.setDate(today.getDate() + 1);
    end.setDate(today.getDate() + 1);
  } else {
    // Default to upcoming 2 working days
    start.setDate(today.getDate() + 1);
    end.setDate(today.getDate() + 2);
  }

  const startDateStr = start.toISOString().substring(0, 10);
  const endDateStr = end.toISOString().substring(0, 10);

  const parsedJson = {
    leaveTypeId: matchingType.id,
    leaveTypeCode: matchingType.code,
    leaveTypeName: matchingType.name,
    startDate: startDateStr,
    endDate: endDateStr,
    reason: reason.replace(/[.,!]$/, ''),
    isAiGenerated: true,
    label: 'AI-generated',
  };

  await recordAiLog({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    prompt: `[Smart Leave] ${textPrompt}`,
    toolCalled: 'smart_leave_parser',
    toolResult: parsedJson,
    response: `Pre-filled ${matchingType.name} from ${startDateStr} to ${endDateStr}`,
  });

  return parsedJson;
}

/**
 * Dashboard Summary (3-5 insight bullets using only provided KPI numbers)
 */
async function generateDashboardSummary(kpiData, user) {
  checkRateLimit(user.id);
  const activeStaff = kpiData?.headcount?.active ?? 0;
  const attRate = kpiData?.attendance?.rate ?? 0;
  const lateRate = kpiData?.attendance?.latePercentage ?? 0;
  const absentRate = kpiData?.attendance?.absenteeismRate ?? 0;
  const attrition = kpiData?.headcount?.attritionRate ?? 0;

  const bullets = [
    `Current active workforce stands at **${activeStaff} employees** with an annualized attrition rate of **${attrition}%**.`,
    `Overall monthly attendance rate is recorded at **${attRate}%**, with late arrival incidence of **${lateRate}%**.`,
    `Department absenteeism is tracked at **${absentRate}%** across scheduled working days.`,
    `All figures are computed directly via database aggregations over currently active department filters.`,
  ];

  const summaryText = bullets.map((b) => `• ${b}`).join('\n\n');

  await recordAiLog({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    prompt: '[Dashboard Summarize]',
    toolCalled: 'dashboard_summarize',
    toolResult: kpiData,
    response: summaryText,
  });

  return {
    summary: summaryText,
    bullets,
    isAiGenerated: true,
    label: 'AI-generated',
  };
}

/**
 * Local deterministic assistant fallback invoking exact service tools
 */
async function executeLocalAssistant({ prompt, user }) {
  const p = prompt.toLowerCase().trim();

  // 1. Policy Q&A
  if (p.includes('policy') || p.includes('rule') || p.includes('hours') || p.includes('grace') || p.includes('late mark') || p.includes('formula')) {
    const result = await executeTool('get_company_policies', {}, user);
    return {
      reply: `### 📋 HCM Lite Company Policies & Attendance Rules\n\n` +
        `- **Company Name:** ${result.companyName}\n` +
        `- **Office Hours:** ${result.officeStartTime} to ${result.officeEndTime}\n` +
        `- **Grace Period:** ${result.graceMinutes} minutes (check-ins after 09:15 are marked **LATE**)\n` +
        `- **Half-Day Rule:** Shifts under 5.0 hours are classified as **HALF DAY**\n` +
        `- **Weekends:** ${result.weekends}\n\n` +
        `#### Leave Quotas (Annual):\n` +
        result.leaveQuotas.map((l) => `- **${l.type}:** ${l.quota}`).join('\n') +
        `\n\n#### Payroll Formula:\n` +
        `- **Gross:** ${result.payrollFormulas.gross}\n` +
        `- **Per Day Rate:** ${result.payrollFormulas.perDayRate}\n` +
        `- **Deductions:** ${result.payrollFormulas.deductions}\n` +
        `- **Tax Slabs:** ${result.payrollFormulas.taxSlabs}`,
      toolUsed: 'get_company_policies',
      toolResult: result,
    };
  }

  // 2. Who is on leave today / get_leave_summary
  if (p.includes('who is on leave') || p.includes('on leave today') || p.includes('leave summary')) {
    const res = await executeTool('get_leave_summary', {}, user);
    if (res.totalOnLeave === 0) {
      return {
        reply: `There are **0 employees** on leave for ${res.date}.`,
        toolUsed: 'get_leave_summary',
        toolResult: res,
      };
    }
    return {
      reply: `### 🏖️ Employees on Leave (${res.totalOnLeave} today)\n\n` +
        res.employees.map((e) => `- **${e.name}** [${e.department}]: ${e.leaveType} (${e.startDate} to ${e.endDate})`).join('\n'),
      toolUsed: 'get_leave_summary',
      toolResult: res,
    };
  }

  // 3. Who came late most often / get_late_comers
  if (p.includes('late') && (p.includes('who') || p.includes('most') || p.includes('top') || p.includes('often') || p.includes('comers'))) {
    const res = await executeTool('get_late_comers', {}, user);
    if (res.topLateComers.length === 0) {
      return {
        reply: `No late arrivals recorded for month ${res.month}.`,
        toolUsed: 'get_late_comers',
        toolResult: res,
      };
    }
    return {
      reply: `### ⏰ Top Frequent Late-Comers (${res.month})\n\n` +
        res.topLateComers.map((c) => `- **${c.name}** (${c.employeeCode}, ${c.department}): **${c.lateCount} late arrivals**`).join('\n'),
      toolUsed: 'get_late_comers',
      toolResult: res,
    };
  }

  // 4. Headcount / get_headcount
  if (p.includes('headcount') || p.includes('how many active') || p.includes('how many employees')) {
    const res = await executeTool('get_headcount', {}, user);
    return {
      reply: `### 👥 Company Headcount Summary\n\n` +
        `- **Active Employees:** ${res.activeHeadcount}\n` +
        `- **Attrition Rate:** ${res.attritionRate}\n\n` +
        `**By Department:**\n` +
        res.departments.map((d) => `- **${d.name}:** ${d.headcount}`).join('\n'),
      toolUsed: 'get_headcount',
      toolResult: res,
    };
  }

  // 5. Attendance rate / get_attendance_summary
  if (p.includes('attendance rate') || p.includes('today attendance') || p.includes('attendance summary')) {
    const res = await executeTool('get_attendance_summary', {}, user);
    return {
      reply: `### 📊 Attendance Summary for ${res.date}\n\n` +
        `- **Monthly Attendance Rate:** ${res.monthlyAttendanceRate}\n` +
        `- **Monthly Late Rate:** ${res.monthlyLatePercentage}\n` +
        `- **Present Today:** ${res.todayPresent}\n` +
        `- **Late Arrivals Today:** ${res.todayLate}\n` +
        `- **On Leave Today:** ${res.todayOnLeave}\n` +
        `- **Absent Today:** ${res.todayAbsent}`,
      toolUsed: 'get_attendance_summary',
      toolResult: res,
    };
  }

  // 6. Leave balance query / get_my_leave_balance
  if (p.includes('sick leave') || p.includes('leave balance') || p.includes('my balance') || p.includes('how many leaves')) {
    const balances = await executeTool('get_my_leave_balance', {}, user);
    if (balances.error) return { reply: balances.error };

    let table = '| Leave Type | Annual Quota | Used Days | Remaining |\n| --- | --- | --- | --- |\n';
    balances.forEach((b) => {
      table += `| **${b.name}** | ${b.annualQuota} | ${b.usedDays} | **${b.remainingDays}** |\n`;
    });

    return {
      reply: `### 🏖️ Your Current Leave Balances\n\n${table}\n*Leaves count working days only, skipping weekends and approved holidays.*`,
      toolUsed: 'get_my_leave_balance',
      toolResult: balances,
    };
  }

  // 7. Payslip / personal salary
  if (p.includes('my payslip') || p.includes('my salary') || p.includes('my net pay')) {
    const slip = await executeTool('get_my_latest_payslip', {}, user);
    if (slip.message) return { reply: slip.message };
    if (slip.error) return { reply: slip.error };

    return {
      reply: `### 💵 Latest Payslip Summary (${slip.period})\n\n` +
        `- **Basic Salary:** $${slip.basicSalary.toLocaleString()}\n` +
        `- **HRA Allowance (40%):** $${slip.hraAllowance.toLocaleString()}\n` +
        `- **Medical Allowance (10%):** $${slip.medicalAllowance.toLocaleString()}\n` +
        `- **Gross Earnings (1.5x):** $${slip.grossSalary.toLocaleString()}\n` +
        `- **Deductions:** $${slip.totalDeductions.toLocaleString()} (Tax TDS: $${slip.incomeTaxDeduction}, Penalties: $${slip.absenteeismDeduction})\n` +
        `### **Net Take Home Pay: $${slip.netSalary.toLocaleString()}**\n\n` +
        `*You can download the full signed PDF payslip in the Payroll section.*`,
      toolUsed: 'get_my_latest_payslip',
      toolResult: slip,
    };
  }

  // 8. Payroll summary (Admin)
  if ((p.includes('payroll run') || p.includes('payroll cost')) && user.role === ROLES.ADMIN) {
    const runs = await executeTool('get_payroll_summary', {}, user);
    return {
      reply: `### 💰 Monthly Payroll Runs\n\n` +
        runs.map((r) => `- **${r.period} [${r.status}]:** Total Gross $${r.totalGross.toLocaleString()}, Net $${r.totalNet.toLocaleString()} (${r.employeesIncluded} employees)`).join('\n'),
      toolUsed: 'get_payroll_summary',
      toolResult: runs,
    };
  }

  // 9. Employee search / search_employees
  if (p.includes('search') || p.includes('find employee')) {
    const q = p.replace(/search|find|employee|for/g, '').trim();
    const res = await executeTool('search_employees', { query: q }, user);
    return {
      reply: `### 🔍 Employee Search Results (${res.total})\n\n` +
        res.employees.map((e) => `- **${e.name}** (${e.code}): ${e.designation} in ${e.department} [${e.status}]`).join('\n'),
      toolUsed: 'search_employees',
      toolResult: res,
    };
  }

  // Default guide
  return {
    reply: `Hello! I am your **HCM Lite AI Assistant**.\n\n` +
      `Here are some live queries you can ask based on your **${user.role}** role:\n\n` +
      (user.role === ROLES.EMPLOYEE
        ? `- *"How many sick leaves do I have left this year?"*\n- *"What is my latest take-home pay?"*\n- *"What are company office hours and late arrival policies?"*`
        : user.role === ROLES.HR
        ? `- *"Who is on leave today?"*\n- *"Who came late most often this month?"*\n- *"How many active employees are in Engineering?"*\n- *"What is this month's attendance rate?"*`
        : `- *"Give me a headcount summary by department"*\n- *"Show recent monthly payroll costs"*\n- *"Who is on leave today?"*\n- *"What are company policies on overtime and grace time?"*`),
  };
}

module.exports = {
  processUserPrompt,
  parseSmartLeavePrompt,
  generateDashboardSummary,
  checkRateLimit,
};
