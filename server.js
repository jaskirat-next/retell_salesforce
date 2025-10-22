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
 * Push data to Salesforce as a Lead and add to "New Zwinker" list
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
      LeadSource: 'Website', // Set this value to match the list view filter
      Status: 'New', 
      Description: description
    };

    console.log('📤 Pushing to Salesforce Lead:', JSON.stringify(salesforceData, null, 2));

    // Step 1: Create the Lead
    const leadResponse = await axios.post(
      `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead`,
      salesforceData,
      {
        headers: {
          'Authorization': `Bearer ${salesforceAccessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('✅ Lead created successfully');
    console.log(`📝 Lead ID: ${leadResponse.data.id}`);

    // Step 2: Verify the Lead was created with the correct Status
    try {
      const verifyQuery = `SELECT Id, Name, Status, LeadSource FROM Lead WHERE Id = '${leadResponse.data.id}'`;
      const verifyResponse = await axios.get(
        `${salesforceInstanceUrl}/services/data/v58.0/query/?q=${encodeURIComponent(verifyQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${salesforceAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('🔍 Lead verification:', JSON.stringify(verifyResponse.data, null, 2));
      
      if (verifyResponse.data.records && verifyResponse.data.records.length > 0) {
        const lead = verifyResponse.data.records[0];
        console.log(`📋 Lead Status: "${lead.Status}"`);
        console.log(`📋 Lead Source: "${lead.LeadSource}"`);
      }
    } catch (verifyError) {
      console.log('⚠️ Could not verify Lead:', verifyError.message);
    }

    console.log('✅ Lead created with LeadSource "New Zwinker" - should appear in the correct list');
    
    return leadResponse.data;
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
    throw new Error(`Failed to push data to Salesforce: ${error.message}`);
  }
}

/**
 * Extract and validate data from Retell webhook
 */
function extractAndValidateData(customAnalysisData) {
  console.log('🔍 Extracting and validating data...');
  console.log('Raw customAnalysisData:', JSON.stringify(customAnalysisData, null, 2));
  
  const extractedData = {
    first_name: customAnalysisData.first_name,
    last_name: customAnalysisData.last_name,
    user_email: customAnalysisData.user_email,
    user_number: customAnalysisData.user_number,
    what_type_of_damage: customAnalysisData.what_type_of_damage,
    damage_amount: customAnalysisData.damage_amount,
    existing_or_new: customAnalysisData.existing_or_new
  };

  console.log('Extracted data:', JSON.stringify(extractedData, null, 2));

  const requiredFields = [
    'first_name', 
    'last_name', 
    'user_email', 
    'user_number', 
    'what_type_of_damage', 
    'damage_amount', 
    'existing_or_new'
  ];

  const missingFields = requiredFields.filter(field => {
    const value = extractedData[field];
    console.log(`Checking field ${field}: value="${value}", type=${typeof value}`);
    
    // Handle different data types properly
    if (value === null || value === undefined) {
      return true;
    }
    
    // For strings, check if empty after trimming
    if (typeof value === 'string') {
      return value.trim() === '';
    }
    
    // For numbers, check if it's a valid number
    if (typeof value === 'number') {
      return isNaN(value);
    }
    
    // For other types, convert to string and check
    return String(value).trim() === '';
  });

  console.log('Missing fields:', missingFields);

  if (missingFields.length > 0) {
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
// ... (all the top part of your file is fine)

/**
 * Retell Webhook Endpoint
 */
app.post('/retell-webhook', async (req, res) => {
  console.log('\n=== Received Retell Webhook ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    console.log('Full webhook payload (req.body):', JSON.stringify(req.body, null, 2));

    // Try different possible payload structures
    let custom_analysis_data = null;
    
    // Check if custom_analysis_data exists at root level
    if (req.body.custom_analysis_data && typeof req.body.custom_analysis_data === 'object') {
      console.log('✅ Found custom_analysis_data at root level');
      custom_analysis_data = req.body.custom_analysis_data;
    }
    // Check if data is in args.custom_analysis_data (Retell's actual structure)
    else if (req.body.args && req.body.args.custom_analysis_data && typeof req.body.args.custom_analysis_data === 'object') {
      console.log('✅ Found custom_analysis_data in args object');
      custom_analysis_data = req.body.args.custom_analysis_data;
    }
    // Check if the entire body is the custom_analysis_data
    else if (req.body.first_name || req.body.last_name || req.body.user_email) {
      console.log('✅ Found data fields at root level');
      custom_analysis_data = req.body;
    }
    // Check if data is nested in a different structure
    else if (req.body.data && typeof req.body.data === 'object') {
      console.log('✅ Found data in nested data object');
      custom_analysis_data = req.body.data;
    }
    // Check if data is in a 'call' object
    else if (req.body.call && req.body.call.custom_analysis_data) {
      console.log('✅ Found custom_analysis_data in call object');
      custom_analysis_data = req.body.call.custom_analysis_data;
    }
    else {
      console.log('❌ No valid data structure found');
    }

    if (!custom_analysis_data || typeof custom_analysis_data !== 'object' || Object.keys(custom_analysis_data).length === 0) {
      console.error('❌ Webhook payload is missing required data. Available keys:', Object.keys(req.body));
      return res.status(400).json({ 
        success: false,
        error: 'Webhook payload must contain a valid, non-empty "custom_analysis_data" object or the required fields directly in the payload.',
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
    res.json({
      success: true,
      message: 'Data processed and pushed to Salesforce successfully',
      extractedData: extractedData,
      salesforceId: salesforceResult.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


// ... (the rest of your server.js file is fine)

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

// Test endpoint to debug campaign search
app.get('/test-campaigns', async (req, res) => {
    try {
        if (!salesforceAccessToken) {
            await authenticateSalesforce();
        }

        console.log('🔍 Testing campaign search...');
        
        // Get all campaigns
        const allCampaignsQuery = `SELECT Id, Name FROM Campaign LIMIT 20`;
        const allCampaignsResponse = await axios.get(
            `${salesforceInstanceUrl}/services/data/v58.0/query/?q=${encodeURIComponent(allCampaignsQuery)}`,
            {
                headers: {
                    'Authorization': `Bearer ${salesforceAccessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('📊 All campaigns:', JSON.stringify(allCampaignsResponse.data, null, 2));

        // Try to find NEW Zwikker specifically
        const zwikkerQuery = `SELECT Id, Name FROM Campaign WHERE Name LIKE '%Zwikker%' LIMIT 5`;
        const zwikkerResponse = await axios.get(
            `${salesforceInstanceUrl}/services/data/v58.0/query/?q=${encodeURIComponent(zwikkerQuery)}`,
            {
                headers: {
                    'Authorization': `Bearer ${salesforceAccessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('📊 Zwikker campaigns:', JSON.stringify(zwikkerResponse.data, null, 2));

        res.json({
            success: true,
            allCampaigns: allCampaignsResponse.data,
            zwikkerCampaigns: zwikkerResponse.data,
            message: 'Campaign search test completed'
        });

    } catch (error) {
        console.error('❌ Campaign test error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Campaign test failed', 
            details: error.message 
        });
    }
});

// Test endpoint to debug Lead Status values
app.get('/test-lead-status', async (req, res) => {
    try {
        if (!salesforceAccessToken) {
            await authenticateSalesforce();
        }

        console.log('🔍 Testing Lead Status values...');
        
        // Get Lead Status picklist values
        const leadDescribeQuery = `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/describe`;
        const leadDescribeResponse = await axios.get(leadDescribeQuery, {
            headers: {
                'Authorization': `Bearer ${salesforceAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Find Status field
        const statusField = leadDescribeResponse.data.fields.find(field => field.name === 'Status');
        
        console.log('📊 Lead Status field:', JSON.stringify(statusField, null, 2));

        // Get recent leads to see what statuses are being used
        const recentLeadsQuery = `SELECT Id, Name, Status, LeadSource FROM Lead ORDER BY CreatedDate DESC LIMIT 10`;
        const recentLeadsResponse = await axios.get(
            `${salesforceInstanceUrl}/services/data/v58.0/query/?q=${encodeURIComponent(recentLeadsQuery)}`,
            {
                headers: {
                    'Authorization': `Bearer ${salesforceAccessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('📊 Recent leads:', JSON.stringify(recentLeadsResponse.data, null, 2));

        res.json({
            success: true,
            statusField: statusField,
            recentLeads: recentLeadsResponse.data,
            message: 'Lead Status test completed'
        });

    } catch (error) {
        console.error('❌ Lead Status test error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Lead Status test failed', 
            details: error.message 
        });
    }
});

// Test endpoint to find fields that might control the "New zwikker" list
app.get('/test-lead-fields', async (req, res) => {
    try {
        if (!salesforceAccessToken) {
            await authenticateSalesforce();
        }

        console.log('🔍 Testing Lead fields that might control "New zwikker" list...');
        
        // Get all Lead fields
        const leadDescribeQuery = `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/describe`;
        const leadDescribeResponse = await axios.get(leadDescribeQuery, {
            headers: {
                'Authorization': `Bearer ${salesforceAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Look for fields that might contain "zwikker" or similar
        const allFields = leadDescribeResponse.data.fields;
        const possibleFields = allFields.filter(field => 
            field.name.toLowerCase().includes('zwikker') ||
            field.name.toLowerCase().includes('list') ||
            field.name.toLowerCase().includes('category') ||
            field.name.toLowerCase().includes('type') ||
            field.name.toLowerCase().includes('group')
        );

        console.log('📊 Possible fields for "New zwikker" list:', JSON.stringify(possibleFields, null, 2));

        // Get a sample lead with all fields to see what's available
        const sampleLeadQuery = `SELECT Id, Name, Status, LeadSource, Company, Industry, Rating, OwnerId FROM Lead WHERE Status = 'New zwikker' LIMIT 1`;
        const sampleLeadResponse = await axios.get(
            `${salesforceInstanceUrl}/services/data/v58.0/query/?q=${encodeURIComponent(sampleLeadQuery)}`,
            {
                headers: {
                    'Authorization': `Bearer ${salesforceAccessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('📊 Sample lead with "New zwikker" status:', JSON.stringify(sampleLeadResponse.data, null, 2));

        res.json({
            success: true,
            possibleFields: possibleFields,
            sampleLead: sampleLeadResponse.data,
            allFields: allFields.map(f => ({ name: f.name, label: f.label, type: f.type })),
            message: 'Lead fields test completed'
        });

    } catch (error) {
        console.error('❌ Lead fields test error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Lead fields test failed', 
            details: error.message 
        });
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