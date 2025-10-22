require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing request bodies
// express.json() parses incoming requests with JSON payloads
// express.urlencoded() parses incoming requests with urlencoded payloads (like form data)
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

// Global variable to store access token and instance URL
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
      console.error('Salesforce Auth Error Details:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    throw error; // Re-throw to propagate the error
  }
}

/**
 * Push data to Salesforce as a Lead for "New Zwinker" list view
 */
async function pushToSalesforce(data) {
  try {
    if (!salesforceAccessToken) {
      console.log('Salesforce access token not found, attempting re-authentication...');
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
      Status: 'New', // This should make it appear in "New Zwinker" list view
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
        timeout: 10000 // 10 seconds timeout for Salesforce API call
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
      
      if (error.response.status === 401 && error.response.data && error.response.data[0] && error.response.data[0].errorCode === 'INVALID_SESSION_ID') {
        console.log('🔄 Salesforce session expired, attempting re-authentication and retry...');
        salesforceAccessToken = null; // Invalidate token to force re-auth
        await authenticateSalesforce();
        return pushToSalesforce(data); // Retry the push operation
      }
    } else {
      console.error('Error message:', error.message);
    }
    throw new Error(`Failed to push data to Salesforce: ${error.message}`); // Re-throw with a more descriptive message
  }
}

/**
 * Extract and validate data from Retell webhook
 */
function extractAndValidateData(payloadData) { // Renamed param for clarity
  console.log('🔍 Extracting and validating data from payload...');
  
  // Ensure payloadData is an object before attempting to access properties
  if (typeof payloadData !== 'object' || payloadData === null) {
      throw new Error('Invalid payload: expected an object for custom_analysis_data.');
  }

  // Handle both field name variations (if 'damage_type' or 'what_type_of_damage' exist)
  const extractedData = {
    first_name: payloadData.first_name,
    last_name: payloadData.last_name,
    user_email: payloadData.user_email,
    user_number: payloadData.user_number,
    // Prioritize what_type_of_damage, fall back to damage_type
    what_type_of_damage: payloadData.what_type_of_damage || payloadData.damage_type, 
    damage_amount: payloadData.damage_amount,
    existing_or_new: payloadData.existing_or_new
  };

  console.log('📋 Extracted data:', JSON.stringify(extractedData, null, 2));

  // Validate required fields explicitly
  const requiredFields = ['first_name', 'last_name', 'user_email', 'user_number', 'what_type_of_damage', 'damage_amount', 'existing_or_new'];
  const missingFields = requiredFields.filter(field => {
    const value = extractedData[field];
    // Check for null, undefined, empty string, or value that is not a number when expected (damage_amount)
    if (field === 'damage_amount') {
        return value === null || value === undefined || isNaN(value);
    }
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing or invalid required fields: ${missingFields.join(', ')}`);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (extractedData.user_email && !emailRegex.test(extractedData.user_email)) {
    throw new Error('Invalid email format for user_email');
  }

  // Validate user_number format (allow optional '+' and any number of digits)
  const phoneNumberRegex = /^\+?[0-9]+$/;
  if (extractedData.user_number && !phoneNumberRegex.test(extractedData.user_number)) {
      throw new Error('Invalid phone number format for user_number. Must be digits, optional leading "+".');
  }

  // Validate damage_amount is a number
  if (extractedData.damage_amount && isNaN(extractedData.damage_amount)) {
      throw new Error('Invalid damage_amount: must be a number.');
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
    // --- Crucial Debugging Step ---
    console.log('Incoming Request Headers:', req.headers);
    console.log('Full webhook payload (req.body received by Express):', JSON.stringify(req.body, null, 2));
    // --- End Debugging Step ---

    // The data we expect to process is directly in req.body.
    // If Retell AI wraps it in 'custom_analysis_data', you'd use req.body.custom_analysis_data
    // Based on your curl command and previous errors, we assume req.body IS the data.
    const custom_analysis_data = req.body; 

    if (!custom_analysis_data || typeof custom_analysis_data !== 'object' || Object.keys(custom_analysis_data).length === 0) {
      console.error('❌ Webhook payload is empty or not a valid JSON object after parsing.');
      // Return a standard JSON error response
      return res.status(400).json({ 
        success: false,
        error: 'Webhook payload is empty or not a valid JSON object. Ensure Content-Type is application/json and body is valid JSON.',
        timestamp: new Date().toISOString()
      });
    }

    console.log('Custom analysis data passed to validation:', JSON.stringify(custom_analysis_data, null, 2));

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
    
    // Ensure the error response is always a single, well-formed JSON object
    const errorResponse = {
      success: false,
      error: error.message, // Use the error message from the thrown error
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
app.get('/test-sf-connection', async () => { // Removed res from params, it's not used
  try {
    const authResult = await authenticateSalesforce();
    return {
      success: true,
      message: 'Salesforce connection test successful',
      instanceUrl: salesforceInstanceUrl,
      authenticated: true
    };
  } catch (error) {
    console.error('❌ Salesforce connection test failed:', error.message);
    throw new Error('Salesforce connection test failed'); // Re-throw to indicate failure
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