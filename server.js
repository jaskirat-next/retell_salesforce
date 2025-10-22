require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Salesforce configuration
const SALESFORCE_CONFIG = {
  username: process.env.SF_USERNAME,
  // NOTE: Salesforce API login usually requires the security token appended to the password.
  // If you get INVALID_LOGIN, this is the reason.
  password: `${process.env.SF_PASSWORD}${process.env.SF_SECURITY_TOKEN || ''}`,
  client_id: process.env.SF_CLIENT_ID,
  client_secret: process.env.SF_CLIENT_SECRET,
  loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
};

// Global variable to store access token
let salesforceAccessToken = null;
let salesforceInstanceUrl = null;

/**
 * Authenticate with Salesforce and get access token
 */
async function authenticateSalesforce() {
  try {
    console.log('Authenticating with Salesforce...');
    
    const requestBody = new URLSearchParams({
      grant_type: 'password',
      client_id: SALESFORCE_CONFIG.client_id,
      client_secret: SALESFORCE_CONFIG.client_secret,
      username: SALESFORCE_CONFIG.username,
      password: SALESFORCE_CONFIG.password
    });

    const response = await axios.post(
      // <-- FIX: Used backticks (`) for template literal syntax
      `${SALESFORCE_CONFIG.loginUrl}/services/oauth2/token`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    salesforceAccessToken = response.data.access_token;
    salesforceInstanceUrl = response.data.instance_url;
    
    console.log('✅ Salesforce authentication successful');
    // <-- FIX: Used backticks (`) for template literal syntax
    console.log(`Instance URL: ${salesforceInstanceUrl}`);
    
    return { accessToken: salesforceAccessToken, instanceUrl: salesforceInstanceUrl };
  } catch (error) {
    console.error('❌ Salesforce authentication failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

/**
 * Push data to Salesforce as a Lead
 */
async function pushToSalesforce(data) {
  try {
    if (!salesforceAccessToken) {
      await authenticateSalesforce();
    }

    const description = `CLAIM INFORMATION:
• Damage Type: ${data.what_type_of_damage || 'Not specified'}
• Damage Amount: ${data.damage_amount || 'Not specified'} 
• Claim Type: ${data.existing_or_new || 'Not specified'}
• Source: Retell AI Call
• Date: ${new Date().toISOString()}`;

    const salesforceData = {
      FirstName: data.first_name,
      LastName: data.last_name,
      Email: data.user_email,
      Phone: data.user_number,
      Company: 'Insurance Claim Customer',
      LeadSource: 'Retell AI Call',
      Status: 'New',
      Description: description
    };

    console.log('📤 Pushing to Salesforce:', JSON.stringify(salesforceData, null, 2));

    const response = await axios.post(
      // <-- FIX: Used backticks (`) for template literal syntax
      `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead`,
      salesforceData,
      {
        headers: {
          // <-- FIX: Used backticks (`) for template literal syntax
          'Authorization': `Bearer ${salesforceAccessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ Data pushed to Salesforce successfully');
    console.log(`📝 Lead ID: ${response.data.id}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error pushing to Salesforce:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('🔄 Token expired, re-authenticating...');
        salesforceAccessToken = null; // Clear expired token
        return pushToSalesforce(data); // Retry the request
      }
    } else {
      console.error('Error message:', error.message);
    }
    // <-- FIX: Used backticks (`) for template literal syntax
    throw new Error(`Failed to push data to Salesforce: ${error.message}`);
  }
}

/**
 * Extract and validate data from Retell webhook
 */
function extractAndValidateData(customAnalysisData) {
  console.log('🔍 Extracting and validating data...');
  
  const extractedData = {
    first_name: customAnalysisData.first_name,
    last_name: customAnalysisData.last_name,
    user_email: customAnalysisData.user_email,
    user_number: customAnalysisData.user_number,
    what_type_of_damage: customAnalysisData.what_type_of_damage,
    damage_amount: customAnalysisData.damage_amount,
    existing_or_new: customAnalysisData.existing_or_new
  };

  // --- START OF FIX ---
  // The error message clearly shows these fields are required.
  // Your old code only checked for 3 of them. This is the fix.
  const requiredFields = [
    'first_name', 
    'last_name', 
    'user_email', 
    'user_number', 
    'what_type_of_damage', 
    'damage_amount', 
    'existing_or_new'
  ];
  // --- END OF FIX ---

  const missingFields = requiredFields.filter(field => {
    const value = extractedData[field];
    return value === null || value === undefined || value.toString().trim() === '';
  });

  if (missingFields.length > 0) {
    // <-- FIX: Used backticks (`) for template literal syntax
    throw new Error(`Missing or invalid required fields: ${missingFields.join(', ')}`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(extractedData.user_email)) {
    throw new Error('Invalid email format');
  }

  console.log('✅ Data validation passed');
  return extractedData;
}

/**
 * Retell Webhook Endpoint
 */
app.post('/retell-webhook', async (req, res) => {
  console.log('\n=== Received Retell Webhook ===');
  try {
    console.log('Full webhook payload:', JSON.stringify(req.body, null, 2));
    const { custom_analysis_data } = req.body;

    if (!custom_analysis_data) {
      return res.status(400).json({ 
        success: false,
        error: 'No custom_analysis_data found in webhook payload' 
      });
    }

    const extractedData = extractAndValidateData(custom_analysis_data);
    const salesforceResult = await pushToSalesforce(extractedData);

    res.json({
      success: true,
      message: 'Data processed and pushed to Salesforce successfully',
      salesforceId: salesforceResult.id
    });

  } catch (error) {
    console.error(`❌ Webhook processing error: ${error.message}`);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/* Health check and other endpoints remain the same */
app.get('/', (req, res) => res.json({ status: 'OK' }));
app.get('/health', (req, res) => res.json({ status: 'OK', salesforce: salesforceAccessToken ? 'Connected' : 'Disconnected' }));
app.get('/test-sf-connection', async (req, res) => {
    try {
        await authenticateSalesforce();
        res.json({ success: true, message: 'Salesforce connection test successful' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Salesforce connection test failed', details: error.message });
    }
});

app.listen(PORT, async () => {
  // <-- FIX: Used backticks (`) for template literal syntax
  console.log(`🚀 Server Started on Port: ${PORT}`);
  try {
    await authenticateSalesforce();
    console.log('✅ Salesforce connection established on startup');
  } catch (error) {
    console.log('⚠️ Salesforce connection failed on startup. Will retry on first webhook.');
  }
});