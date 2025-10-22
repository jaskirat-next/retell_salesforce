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
  password: process.env.SF_PASSWORD,
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
      `${SALESFORCE_CONFIG.loginUrl}/services/oauth2/token`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    salesforceAccessToken = response.data.access_token;
    salesforceInstanceUrl = response.data.instance_url;
    
    console.log('✅ Salesforce authentication successful');
    console.log(`Instance URL: ${salesforceInstanceUrl}`);
    
    return {
      accessToken: salesforceAccessToken,
      instanceUrl: salesforceInstanceUrl
    };
  } catch (error) {
    console.error('❌ Salesforce authentication failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

/**
 * Push data to Salesforce as a Lead for "New Zwinker" list view
 */
async function pushToSalesforce(data) {
  try {
    if (!salesforceAccessToken) {
      await authenticateSalesforce();
    }

    // Create description with all the custom data
    const description = `CLAIM INFORMATION:
• Damage Type: ${data.what_type_of_damage || 'Not specified'}
• Damage Amount: ${data.damage_amount || 'Not specified'} 
• Claim Type: ${data.existing_or_new || 'Not specified'}
• Source: Retell AI Call
• Date: ${new Date().toISOString()}

CONTACT INFORMATION:
• Name: ${data.first_name} ${data.last_name}
• Email: ${data.user_email}
• Phone: ${data.user_number || 'Not provided'}`;

    // Use standard fields only
    const salesforceData = {
      FirstName: data.first_name || '',
      LastName: data.last_name || '',
      Email: data.user_email || '',
      Phone: data.user_number || '',
      Company: 'Insurance Claim Customer',
      LeadSource: 'Retell AI Call',
      Status: 'New', // This will make it appear in "New Zwinker" list view
      Description: description
    };

    console.log('📤 Pushing to Salesforce:', JSON.stringify(salesforceData, null, 2));

    const response = await axios.post(
      `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead`,
      salesforceData,
      {
        headers: {
          'Authorization': `Bearer ${salesforceAccessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ Data pushed to Salesforce successfully');
    console.log('📝 Lead ID:', response.data.id);
    console.log('📍 Lead should appear in "New Zwinker" list view (Status = New)');
    
    return response.data;
  } catch (error) {
    console.error('❌ Error pushing to Salesforce:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('🔄 Token expired, re-authenticating...');
        await authenticateSalesforce();
        return pushToSalesforce(data);
      }
    } else {
      console.error('Error message:', error.message);
    }
    throw new Error(`Failed to push data to Salesforce: ${error.message}`);
  }
}

/**
 * Extract and validate data from Retell webhook
 */
function extractAndValidateData(customAnalysisData) {
  console.log('🔍 Extracting data from webhook...');
  
  // Handle both field name variations (Make.com vs direct Retell)
  const extractedData = {
    first_name: customAnalysisData.first_name,
    last_name: customAnalysisData.last_name,
    user_email: customAnalysisData.user_email,
    user_number: customAnalysisData.user_number,
    what_type_of_damage: customAnalysisData.what_type_of_damage || customAnalysisData.damage_type,
    damage_amount: customAnalysisData.damage_amount,
    existing_or_new: customAnalysisData.existing_or_new
  };

  console.log('📋 Extracted data:', JSON.stringify(extractedData, null, 2));

  // Validate required fields
  const requiredFields = ['first_name', 'last_name', 'user_email'];
  const missingFields = requiredFields.filter(field => !extractedData[field] || extractedData[field].toString().trim() === '');

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (extractedData.user_email && !emailRegex.test(extractedData.user_email)) {
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
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    // Log the complete request body for debugging
    console.log('Full webhook payload (req.body):', JSON.stringify(req.body, null, 2));

    // Now, req.body IS the custom_analysis_data directly
    const custom_analysis_data = req.body; 

    // Check if the received body is an object and not empty
    if (!custom_analysis_data || typeof custom_analysis_data !== 'object' || Object.keys(custom_analysis_data).length === 0) {
      console.log('❌ Invalid or empty custom_analysis_data found in webhook payload');
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or empty custom_analysis_data found in webhook payload' 
      });
    }

    console.log('Custom analysis data received:', JSON.stringify(custom_analysis_data, null, 2));

    // Extract and validate data
    const extractedData = extractAndValidateData(custom_analysis_data);
    console.log('✅ Data extracted successfully:', JSON.stringify(extractedData, null, 2));

    // Push to Salesforce
    const salesforceResult = await pushToSalesforce(extractedData);

    // Success response
    const successResponse = {
      success: true,
      message: 'Data processed and pushed to Salesforce successfully',
      extractedData: extractedData,
      salesforceId: salesforceResult.id,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Webhook processed successfully');
    res.json(successResponse);

  } catch (error) {
    console.error('❌ Webhook processing error:', error.message);
    
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };

    res.status(400).json(errorResponse);
  }
});


/**
 * Health Check Endpoint
 */
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Retell-Salesforce Webhook Server is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: 'POST /retell-webhook',
      health: 'GET /health',
      test: 'GET /test-sf-connection'
    }
  });
});

/**
 * Health Check with Salesforce Connection Test
 */
app.get('/health', async (req, res) => {
  try {
    let sfStatus = 'Not authenticated';
    if (salesforceAccessToken) {
      sfStatus = 'Connected';
    }

    res.json({
      status: 'OK',
      server_time: new Date().toISOString(),
      salesforce: sfStatus,
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      error: error.message
    });
  }
});

/**
 * Test Salesforce Connection
 */
app.get('/test-sf-connection', async (req, res) => {
  try {
    const authResult = await authenticateSalesforce();
    res.json({
      success: true,
      message: 'Salesforce connection test successful',
      instanceUrl: salesforceInstanceUrl,
      authenticated: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Salesforce connection test failed',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`
🚀 Retell-Salesforce Webhook Server Started
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV}
⏰ Time: ${new Date().toISOString()}

📋 Available Endpoints:
   GET  /                    - Server status
   GET  /health              - Health check
   GET  /test-sf-connection  - Test Salesforce connection
   POST /retell-webhook      - Retell webhook endpoint

💡 Next steps:
   1. Test Salesforce connection: GET http://localhost:${PORT}/test-sf-connection
   2. Test webhook: POST http://localhost:${PORT}/retell-webhook
   3. Configure Retell webhook URL: http://your-domain.com/retell-webhook
  `);

  // Test Salesforce connection on startup
  try {
    await authenticateSalesforce();
    console.log('✅ Salesforce connection established on startup');
  } catch (error) {
    console.log('⚠️  Salesforce connection failed on startup. Will retry on first webhook.');
  }
});