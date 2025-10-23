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
      `${SALESFORCE_CONFIG.loginUrl}/services/oauth2/token`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    salesforceAccessToken = response.data.access_token;
    salesforceInstanceUrl = response.data.instance_url;
    
    console.log('✅ Salesforce authentication successful');
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
 * Extract and validate data from Retell webhook
 */
function extractAndValidateData(customAnalysisData) {
  console.log('🔍 Extracting and validating data...');
  
  const extractedData = {
    first_name: customAnalysisData.first_name,
    last_name: customAnalysisData.last_name,
    user_email: customAnalysisData.user_email,
    user_number: customAnalysisData.user_number,
    what_type_of_damage: customAnalysisData['What Type of damage'], 
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
    return !value || (typeof value === 'string' && value.trim() === '');
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(extractedData.user_email)) {
    throw new Error('Invalid email format');
  }

  console.log('✅ Data validation passed');
  return extractedData;
}

/**
 * Get valid picklist values for specific fields
 */
async function getPicklistValues(fieldName) {
  try {
    console.log(`🔍 Getting valid picklist values for ${fieldName}...`);
    
    const describeResponse = await axios.get(
      `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/describe`,
      {
        headers: {
          'Authorization': `Bearer ${salesforceAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const field = describeResponse.data.fields.find(f => f.name === fieldName);
    
    if (field && field.picklistValues) {
      const validValues = field.picklistValues
        .filter(value => value.active)
        .map(value => value.value);
      
      console.log(`✅ Valid ${fieldName} values:`, validValues);
      return validValues;
    }
    
    console.log(`⚠️ No picklist values found for ${fieldName}`);
    return [];
  } catch (error) {
    console.error(`❌ Error getting picklist values for ${fieldName}:`, error.message);
    return [];
  }
}

/**
 * Map incoming damage types to valid Salesforce picklist values
 */
function mapDamageTypeToValidValue(incomingDamageType, validPicklistValues) {
  if (!incomingDamageType) return null;
  
  const lowerIncoming = incomingDamageType.toLowerCase().trim();
  
  // Try to find exact match first
  const exactMatch = validPicklistValues.find(value => 
    value.toLowerCase() === lowerIncoming
  );
  
  if (exactMatch) {
    console.log(`✅ Exact match found: "${incomingDamageType}" -> "${exactMatch}"`);
    return exactMatch;
  }
  
  // Try partial matches for common damage types
  const mappingRules = {
    'water': 'Wasserschaden',
    'feuer': 'Brandschaden',
    'brand': 'Brandschaden',
    'sturm': 'Sturmschaden',
    'einbruch': 'Einbruchdiebstahlschaden',
    'diebstahl': 'Einbruchdiebstahlschaden',
    'bau': 'Bauschaden / Baumangel',
    'mangel': 'Bauschaden / Baumangel',
    'beruf': 'Berufsunfähigkeit',
    'unfähigkeit': 'Berufsunfähigkeit',
    'other': 'Sonstiger Schaden',
    'sonstig': 'Sonstiger Schaden',
    'noch kein': 'Noch kein Schadensereignis',
    'kein schaden': 'Noch kein Schadensereignis'
  };
  
  // Check for partial matches in mapping rules
  for (const [key, value] of Object.entries(mappingRules)) {
    if (lowerIncoming.includes(key)) {
      if (validPicklistValues.includes(value)) {
        console.log(`✅ Partial match found: "${incomingDamageType}" -> "${value}"`);
        return value;
      }
    }
  }
  
  // If no match found, use a default valid value or null
  const defaultValue = validPicklistValues.includes('Sonstiger Schaden') ? 'Sonstiger Schaden' : null;
  console.log(`⚠️ No match for "${incomingDamageType}", using default: "${defaultValue}"`);
  return defaultValue;
}

/**
 * Map damage amount to valid picklist values
 */
function mapDamageAmountToValidValue(damageAmount, validPicklistValues) {
  if (!damageAmount) return null;
  
  // Extract numeric value from the amount
  const numericMatch = damageAmount.match(/(\d+[,.]?\d*)/);
  if (!numericMatch) {
    console.log(`⚠️ Could not extract numeric value from: "${damageAmount}"`);
    return null;
  }
  
  const numericValue = parseFloat(numericMatch[1].replace(',', '.'));
  console.log(`🔢 Extracted numeric value: ${numericValue} from "${damageAmount}"`);
  
  // Map to appropriate ranges based on the actual picklist values we found
  if (numericValue <= 5000) {
    return findBestMatch(['0€ - 5.000€'], validPicklistValues);
  } else if (numericValue <= 50000) {
    return findBestMatch(['5.000€ - 50.000€'], validPicklistValues);
  } else if (numericValue <= 100000) {
    return findBestMatch(['50.000€ - 100.000€'], validPicklistValues);
  } else if (numericValue <= 250000) {
    return findBestMatch(['100.000€ - 250.000€'], validPicklistValues);
  } else if (numericValue <= 500000) {
    return findBestMatch(['250.000€ - 500.000€'], validPicklistValues);
  } else if (numericValue <= 1000000) {
    return findBestMatch(['500.000€ - 1.000.000€'], validPicklistValues);
  } else {
    return findBestMatch(['100.000€ +', '1 Mio. € - 2 Mio. €'], validPicklistValues);
  }
}

/**
 * Find the best matching value from available picklist values
 */
function findBestMatch(preferredValues, validPicklistValues) {
  for (const preferred of preferredValues) {
    const match = validPicklistValues.find(value => 
      value.toLowerCase().includes(preferred.toLowerCase())
    );
    if (match) {
      console.log(`✅ Amount mapped to: "${match}"`);
      return match;
    }
  }
  
  // If no match found, return the first valid value or null
  const fallback = validPicklistValues.length > 0 ? validPicklistValues[0] : null;
  console.log(`⚠️ No amount match found, using: "${fallback}"`);
  return fallback;
}

/**
 * Push data to Salesforce as a Lead in NEW Zwikker list
 */
async function pushToSalesforce(data) {
  try {
    if (!salesforceAccessToken) {
      await authenticateSalesforce();
    }

    // Get valid picklist values
    const validDamageTypes = await getPicklistValues('msSchadensart__c');
    const validDamageAmounts = await getPicklistValues('GeschaetzteSchadenshoehe__c');

    // Map values
    const mappedDamageType = mapDamageTypeToValidValue(data.what_type_of_damage, validDamageTypes);
    const mappedDamageAmount = mapDamageAmountToValidValue(data.damage_amount, validDamageAmounts);

    // Build Salesforce data - KEY FIX: Using LeadSource = 'Website' for NEW Zwikker list
    const salesforceData = {
      FirstName: data.first_name,
      LastName: data.last_name,
      Email: data.user_email,
      Phone: data.user_number,
      Company: 'Retell AI Lead',
      LeadSource: 'Website', // ← THIS IS THE FIX! NEW Zwikker requires LeadSource = 'Website'
      Status: 'New',
      msUnternehmensfokus__c: 'Deutsche Schadenshilfe',
      msSchadensart__c: mappedDamageType,
      GeschaetzteSchadenshoehe__c: mappedDamageAmount,
      Description: `Claim Type: ${data.existing_or_new}
Original Damage Type: ${data.what_type_of_damage}
Original Damage Amount: ${data.damage_amount}
Source: Retell AI Call (mapped to Website for NEW Zwikker list)
Date: ${new Date().toISOString()}`
    };

    console.log('📤 Pushing to Salesforce Lead (NEW Zwikker):', JSON.stringify(salesforceData, null, 2));

    // Create the Lead
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

    console.log('✅ Lead created successfully for NEW Zwikker list');
    console.log(`📝 Lead ID: ${leadResponse.data.id}`);
    console.log('🎯 Lead should NOW appear in "NEW Zwikker" list view (LeadSource = Website)');

    return leadResponse.data;
  } catch (error) {
    console.error('❌ Error pushing to Salesforce:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('🔄 Token expired, re-authenticating...');
        salesforceAccessToken = null;
        return pushToSalesforce(data);
      }
    } else {
      console.error('Error message:', error.message);
    }
    throw new Error(`Failed to push data to Salesforce: ${error.message}`);
  }
}

/**
 * Retell Webhook Endpoint
 */
app.post('/retell-webhook', async (req, res) => {
  console.log('\n=== Received Retell Webhook ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const custom_analysis_data = req.body.call?.call_analysis?.custom_analysis_data;

    if (!custom_analysis_data) {
      console.error('❌ Webhook payload is missing data at call.call_analysis.custom_analysis_data');
      return res.status(400).json({ 
        success: false,
        error: 'Webhook payload did not contain the expected Retell AI data structure.',
      });
    }

    // Extract and validate data
    const extractedData = extractAndValidateData(custom_analysis_data);

    // Push to Salesforce with correct LeadSource for NEW Zwikker list
    const salesforceResult = await pushToSalesforce(extractedData);

    // Success response
    res.json({
      success: true,
      message: 'Data processed and pushed to Salesforce NEW Zwikker list successfully',
      salesforceId: salesforceResult.id,
      listView: 'NEW Zwikker',
      note: 'Lead created with LeadSource = "Website" to match NEW Zwikker list filter',
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

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Retell to Salesforce Webhook Server - NEW Zwikker Integration',
    note: 'Leads are now created with LeadSource = "Website" to appear in NEW Zwikker list'
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server Started on Port: ${PORT}`);
  try {
    await authenticateSalesforce();
    console.log('✅ Salesforce connection established on startup');
    console.log('🎯 Leads will be created for NEW Zwikker list using LeadSource = "Website"');
  } catch (error) {
    console.log('⚠️ Salesforce connection failed on startup. Will retry on first webhook.');
  }
});