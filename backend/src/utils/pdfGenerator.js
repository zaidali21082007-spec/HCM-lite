const PDFDocument = require('pdfkit');

/**
 * Generate PDF payslip stream/buffer
 */
function generatePayslipPDF({ companyName = 'HCM Lite Corp', payrollRun, item, employee }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (data) => buffers.push(data));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthStr = monthNames[(payrollRun.month || 1) - 1];
      const yearStr = payrollRun.year;

      // Header Banner
      doc.rect(40, 40, 515, 60).fill('#1E293B'); // Slate 800
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text(companyName, 55, 52);
      doc.fontSize(11).font('Helvetica').fillColor('#94A3B8').text(`PAYSLIP — ${monthStr} ${yearStr}`, 55, 78);

      // Status pill
      const statusText = payrollRun.status === 'FINALIZED' ? 'OFFICIAL / FINALIZED' : 'DRAFT RUN';
      doc.fillColor('#38BDF8').fontSize(9).font('Helvetica-Bold').text(statusText, 420, 56, { align: 'right', width: 120 });

      // Employee Info Card
      doc.rect(40, 115, 515, 85).fill('#F8FAFC');
      doc.rect(40, 115, 515, 85).stroke('#E2E8F0');

      doc.fillColor('#475569').fontSize(9).font('Helvetica');
      
      // Column 1
      doc.text('Employee Code:', 55, 125);
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(employee.employeeCode, 140, 125);
      
      doc.font('Helvetica').fillColor('#475569').text('Employee Name:', 55, 145);
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(`${employee.firstName} ${employee.lastName}`, 140, 145);

      doc.font('Helvetica').fillColor('#475569').text('Email:', 55, 165);
      doc.font('Helvetica').fillColor('#0F172A').text(employee.email, 140, 165);

      // Column 2
      doc.font('Helvetica').fillColor('#475569').text('Department:', 320, 125);
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(employee.department?.name || 'N/A', 400, 125);

      doc.font('Helvetica').fillColor('#475569').text('Designation:', 320, 145);
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(employee.designation?.title || 'N/A', 400, 145);

      doc.font('Helvetica').fillColor('#475569').text('Pay Period:', 320, 165);
      doc.font('Helvetica').fillColor('#0F172A').text(`${monthStr} ${yearStr}`, 400, 165);

      // Attendance Metrics Card
      doc.rect(40, 215, 515, 45).fill('#F1F5F9');
      doc.fillColor('#334155').fontSize(9).font('Helvetica');
      doc.text(`Working Days in Month: ${payrollRun.workingDaysInMonth}`, 55, 225);
      doc.text(`Worked Days: ${item.workedDays || 0}`, 200, 225);
      doc.text(`Absent Days: ${item.absentDays || 0}`, 330, 225);
      doc.text(`Half Days: ${item.halfDays || 0}`, 450, 225);

      if (item.isProrated && item.prorationReason) {
        doc.fillColor('#D97706').fontSize(8).font('Helvetica-Bold').text(`Notice: ${item.prorationReason}`, 55, 243);
      }

      // Earnings & Deductions Table
      const tableTop = 275;
      doc.rect(40, tableTop, 250, 24).fill('#E2E8F0');
      doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold').text('EARNINGS', 55, tableTop + 7);
      doc.text('AMOUNT', 220, tableTop + 7, { align: 'right', width: 60 });

      doc.rect(305, tableTop, 250, 24).fill('#E2E8F0');
      doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold').text('DEDUCTIONS', 320, tableTop + 7);
      doc.text('AMOUNT', 485, tableTop + 7, { align: 'right', width: 60 });

      let currentY = tableTop + 32;

      const earnings = [
        ['Basic Salary', item.basicSalary],
        ['House Rent Allowance (HRA 40%)', item.hraAllowance],
        ['Medical Allowance (10%)', item.medicalAllowance],
      ];

      const deductions = [
        ['Absenteeism & Penalty', item.absenteeismDeduction],
        ['Income Tax (TDS)', item.incomeTaxDeduction],
        ['Other Deductions', item.otherDeductions || 0],
      ];

      for (let i = 0; i < Math.max(earnings.length, deductions.length); i++) {
        doc.font('Helvetica').fontSize(9).fillColor('#334155');
        
        // Left Column (Earnings)
        if (earnings[i]) {
          doc.text(earnings[i][0], 55, currentY);
          doc.text(`$${Number(earnings[i][1]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, currentY, { align: 'right', width: 80 });
        }

        // Right Column (Deductions)
        if (deductions[i]) {
          doc.text(deductions[i][0], 320, currentY);
          doc.text(`$${Number(deductions[i][1]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 465, currentY, { align: 'right', width: 80 });
        }

        currentY += 22;
      }

      // Divider lines
      doc.moveTo(40, currentY).lineTo(555, currentY).stroke('#CBD5E1');
      currentY += 10;

      // Totals Row
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A');
      doc.text('Gross Earnings:', 55, currentY);
      doc.text(`$${Number(item.grossSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, currentY, { align: 'right', width: 80 });

      doc.text('Total Deductions:', 320, currentY);
      doc.fillColor('#DC2626').text(`$${Number(item.totalDeductions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 465, currentY, { align: 'right', width: 80 });

      currentY += 30;

      // Net Pay Highlight Box
      doc.rect(40, currentY, 515, 55).fill('#EEF2FF');
      doc.rect(40, currentY, 515, 55).stroke('#6366F1');

      doc.fillColor('#4338CA').fontSize(12).font('Helvetica-Bold').text('NET TAKE HOME PAY', 55, currentY + 12);
      doc.fillColor('#1E1B4B').fontSize(18).font('Helvetica-Bold').text(`$${Number(item.netSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 350, currentY + 15, { align: 'right', width: 190 });
      doc.fillColor('#6366F1').fontSize(8).font('Helvetica').text('Per Day Standard Rate: $' + (item.perDaySalary || 0), 55, currentY + 34);

      // Footer
      currentY += 80;
      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8');
      doc.text('This is a system-generated document from HCM Lite and requires no signature.', 40, currentY, { align: 'center', width: 515 });
      doc.text(`Generated on: ${new Date().toUTCString()}`, 40, currentY + 14, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePayslipPDF,
};
