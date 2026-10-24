require('dotenv').config();
const app = require('./app');
const prisma = require('./config/prisma');
const setupService = require('./services/setup.service');

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('Connected to database successfully.');

    // App starts empty with no dummy data. First run displays setup screen (or initializes via ADMIN_EMAIL/ADMIN_PASSWORD env).
    let setupStatus = await setupService.getSetupStatus();
    if (!setupStatus.isConfigured) {
      if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        await setupService.performInitialSetup({
          companyName: process.env.COMPANY_NAME || 'HCM Lite Company',
          adminEmail: process.env.ADMIN_EMAIL,
          adminPassword: process.env.ADMIN_PASSWORD,
        });
        setupStatus = await setupService.getSetupStatus();
        console.log(`Initialized master Admin from environment credentials: ${process.env.ADMIN_EMAIL}`);
      } else {
        console.log('App starting empty. First-run setup screen will initialize Company and Admin account.');
      }
    }
    if (setupStatus.isConfigured) {
      console.log(`System ready for company: ${setupStatus.companyName}`);
    }


    app.listen(PORT, () => {
      console.log(`HCM Lite backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
