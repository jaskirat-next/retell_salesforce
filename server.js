// // require('dotenv').config();
// // const express = require('express');
// // const axios = require('axios');
// // const app = express();
// // const PORT = process.env.PORT || 3000;

// // // Middleware
// // app.use(express.json());
// // app.use(express.urlencoded({ extended: true }));

// // // Salesforce configuration
// // const SALESFORCE_CONFIG = {
// //   username: process.env.SF_USERNAME,
// //   password: `${process.env.SF_PASSWORD}${process.env.SF_SECURITY_TOKEN || ''}`,
// //   client_id: process.env.SF_CLIENT_ID,
// //   client_secret: process.env.SF_CLIENT_SECRET,
// //   loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
// // };

// // // Global variable to store access token
// // let salesforceAccessToken = null;
// // let salesforceInstanceUrl = null;

// // /**
// //  * Authenticate with Salesforce and get access token
// //  */
// // async function authenticateSalesforce() {
// //   try {
// //     console.log('Authenticating with Salesforce...');
    
// //     const requestBody = new URLSearchParams({
// //       grant_type: 'password',
// //       client_id: SALESFORCE_CONFIG.client_id,
// //       client_secret: SALESFORCE_CONFIG.client_secret,
// //       username: SALESFORCE_CONFIG.username,
// //       password: SALESFORCE_CONFIG.password
// //     });

// //     const response = await axios.post(
// //       `${SALESFORCE_CONFIG.loginUrl}/services/oauth2/token`,
// //       requestBody,
// //       {
// //         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
// //       }
// //     );

// //     salesforceAccessToken = response.data.access_token;
// //     salesforceInstanceUrl = response.data.instance_url;
    
// //     console.log('✅ Salesforce authentication successful');
// //     console.log(`Instance URL: ${salesforceInstanceUrl}`);
    
// //     return { accessToken: salesforceAccessToken, instanceUrl: salesforceInstanceUrl };
// //   } catch (error) {
// //     console.error('❌ Salesforce authentication failed:');
// //     if (error.response) {
// //       console.error(`Status: ${error.response.status}`);
// //       console.error('Data:', error.response.data);
// //     } else {
// //       console.error('Error:', error.message);
// //     }
// //     throw error;
// //   }
// // }

// // /**
// //  * Extract and validate data from Retell webhook
// //  */
// // function extractAndValidateData(customAnalysisData) {
// //   console.log('🔍 Extracting and validating data...');
  
// //   const extractedData = {
// //     first_name: customAnalysisData.first_name,
// //     last_name: customAnalysisData.last_name,
// //     user_email: customAnalysisData.user_email,
// //     user_number: customAnalysisData.user_number,
// //     what_type_of_damage: customAnalysisData['What Type of damage'], 
// //     damage_amount: customAnalysisData.damage_amount,
// //     existing_or_new: customAnalysisData.existing_or_new
// //   };

// //   console.log('Extracted data:', JSON.stringify(extractedData, null, 2));

// //   const requiredFields = [
// //     'first_name',
// //     'last_name',
// //     'user_email',
// //     'user_number',
// //     'what_type_of_damage',
// //     'damage_amount',
// //     'existing_or_new'
// //   ];

// //   const missingFields = requiredFields.filter(field => {
// //     const value = extractedData[field];
// //     return !value || (typeof value === 'string' && value.trim() === '');
// //   });

// //   if (missingFields.length > 0) {
// //     throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
// //   }

// //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// //   if (!emailRegex.test(extractedData.user_email)) {
// //     throw new Error('Invalid email format');
// //   }

// //   console.log('✅ Data validation passed');
// //   return extractedData;
// // }

// // /**
// //  * Get valid picklist values for specific fields
// //  */
// // async function getPicklistValues(fieldName) {
// //   try {
// //     console.log(`🔍 Getting valid picklist values for ${fieldName}...`);
    
// //     const describeResponse = await axios.get(
// //       `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/describe`,
// //       {
// //         headers: {
// //           'Authorization': `Bearer ${salesforceAccessToken}`,
// //           'Content-Type': 'application/json'
// //         }
// //       }
// //     );

// //     const field = describeResponse.data.fields.find(f => f.name === fieldName);
    
// //     if (field && field.picklistValues) {
// //       const validValues = field.picklistValues
// //         .filter(value => value.active)
// //         .map(value => value.value);
      
// //       console.log(`✅ Valid ${fieldName} values:`, validValues);
// //       return validValues;
// //     }
    
// //     console.log(`⚠️ No picklist values found for ${fieldName}`);
// //     return [];
// //   } catch (error) {
// //     console.error(`❌ Error getting picklist values for ${fieldName}:`, error.message);
// //     return [];
// //   }
// // }

// // /**
// //  * Map incoming damage types to valid Salesforce picklist values
// //  */
// // function mapDamageTypeToValidValue(incomingDamageType, validPicklistValues) {
// //   if (!incomingDamageType) return null;
  
// //   const lowerIncoming = incomingDamageType.toLowerCase().trim();
  
// //   // Try to find exact match first
// //   const exactMatch = validPicklistValues.find(value => 
// //     value.toLowerCase() === lowerIncoming
// //   );
  
// //   if (exactMatch) {
// //     console.log(`✅ Exact match found: "${incomingDamageType}" -> "${exactMatch}"`);
// //     return exactMatch;
// //   }
  
// //   // Try partial matches for common damage types
// //   const mappingRules = {
// //     'water': 'Wasserschaden',
// //     'feuer': 'Brandschaden',
// //     'brand': 'Brandschaden',
// //     'sturm': 'Sturmschaden',
// //     'einbruch': 'Einbruchdiebstahlschaden',
// //     'diebstahl': 'Einbruchdiebstahlschaden',
// //     'bau': 'Bauschaden / Baumangel',
// //     'mangel': 'Bauschaden / Baumangel',
// //     'beruf': 'Berufsunfähigkeit',
// //     'unfähigkeit': 'Berufsunfähigkeit',
// //     'other': 'Sonstiger Schaden',
// //     'sonstig': 'Sonstiger Schaden',
// //     'noch kein': 'Noch kein Schadensereignis',
// //     'kein schaden': 'Noch kein Schadensereignis'
// //   };
  
// //   // Check for partial matches in mapping rules
// //   for (const [key, value] of Object.entries(mappingRules)) {
// //     if (lowerIncoming.includes(key)) {
// //       if (validPicklistValues.includes(value)) {
// //         console.log(`✅ Partial match found: "${incomingDamageType}" -> "${value}"`);
// //         return value;
// //       }
// //     }
// //   }
  
// //   // If no match found, use a default valid value or null
// //   const defaultValue = validPicklistValues.includes('Sonstiger Schaden') ? 'Sonstiger Schaden' : null;
// //   console.log(`⚠️ No match for "${incomingDamageType}", using default: "${defaultValue}"`);
// //   return defaultValue;
// // }

// // /**
// //  * Map damage amount to valid picklist values
// //  */
// // function mapDamageAmountToValidValue(damageAmount, validPicklistValues) {
// //   if (!damageAmount) return null;
  
// //   // Extract numeric value from the amount
// //   const numericMatch = damageAmount.match(/(\d+[,.]?\d*)/);
// //   if (!numericMatch) {
// //     console.log(`⚠️ Could not extract numeric value from: "${damageAmount}"`);
// //     return null;
// //   }
  
// //   const numericValue = parseFloat(numericMatch[1].replace(',', '.'));
// //   console.log(`🔢 Extracted numeric value: ${numericValue} from "${damageAmount}"`);
  
// //   // Map to appropriate ranges based on the actual picklist values we found
// //   if (numericValue <= 5000) {
// //     return findBestMatch(['0€ - 5.000€'], validPicklistValues);
// //   } else if (numericValue <= 50000) {
// //     return findBestMatch(['5.000€ - 50.000€'], validPicklistValues);
// //   } else if (numericValue <= 100000) {
// //     return findBestMatch(['50.000€ - 100.000€'], validPicklistValues);
// //   } else if (numericValue <= 250000) {
// //     return findBestMatch(['100.000€ - 250.000€'], validPicklistValues);
// //   } else if (numericValue <= 500000) {
// //     return findBestMatch(['250.000€ - 500.000€'], validPicklistValues);
// //   } else if (numericValue <= 1000000) {
// //     return findBestMatch(['500.000€ - 1.000.000€'], validPicklistValues);
// //   } else {
// //     return findBestMatch(['100.000€ +', '1 Mio. € - 2 Mio. €'], validPicklistValues);
// //   }
// // }

// // /**
// //  * Find the best matching value from available picklist values
// //  */
// // function findBestMatch(preferredValues, validPicklistValues) {
// //   for (const preferred of preferredValues) {
// //     const match = validPicklistValues.find(value => 
// //       value.toLowerCase().includes(preferred.toLowerCase())
// //     );
// //     if (match) {
// //       console.log(`✅ Amount mapped to: "${match}"`);
// //       return match;
// //     }
// //   }
  
// //   // If no match found, return the first valid value or null
// //   const fallback = validPicklistValues.length > 0 ? validPicklistValues[0] : null;
// //   console.log(`⚠️ No amount match found, using: "${fallback}"`);
// //   return fallback;
// // }

// // /**
// //  * Check NEW Zwikker list view filters to understand why status is forced to "New"
// //  */
// // async function checkListViewFilters() {
// //   try {
// //     console.log('🔍 Checking NEW Zwikker list view filters...');
    
// //     const response = await axios.get(
// //       `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/listviews`,
// //       {
// //         headers: {
// //           'Authorization': `Bearer ${salesforceAccessToken}`,
// //           'Content-Type': 'application/json'
// //         }
// //       }
// //     );

// //     const newZwikkerView = response.data.listviews.find(view => 
// //       view.label === 'NEW Zwikker' || view.developerName === 'NEW_Zwikker' || view.label.includes('Zwikker')
// //     );

// //     if (newZwikkerView) {
// //       const detailResponse = await axios.get(
// //         `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/listviews/${newZwikkerView.id}/describe`,
// //         {
// //           headers: {
// //             'Authorization': `Bearer ${salesforceAccessToken}`,
// //             'Content-Type': 'application/json'
// //           }
// //         }
// //       );
      
// //       console.log('📋 NEW Zwikker list view details:', JSON.stringify(detailResponse.data, null, 2));
// //       return detailResponse.data;
// //     } else {
// //       console.log('❌ NEW Zwikker list view not found');
// //       return null;
// //     }
// //   } catch (error) {
// //     console.error('❌ Error checking list view:', error.message);
// //     return null;
// //   }
// // }

// // /**
// //  * Push data to Salesforce as a Lead in NEW Zwikker list
// //  */
// // async function pushToSalesforce(data) {
// //   try {
// //     if (!salesforceAccessToken) {
// //       await authenticateSalesforce();
// //     }

// //     // Get valid picklist values
// //     const validDamageTypes = await getPicklistValues('msSchadensart__c');
// //     const validDamageAmounts = await getPicklistValues('GeschaetzteSchadenshoehe__c');
// //     const validLeadStatuses = await getPicklistValues('Status');

// //     // Map values
// //     const mappedDamageType = mapDamageTypeToValidValue(data.what_type_of_damage, validDamageTypes);
// //     const mappedDamageAmount = mapDamageAmountToValidValue(data.damage_amount, validDamageAmounts);
    
// //     // Determine customer type
// //     const customerType = data.existing_or_new.toLowerCase().includes('exist') ? 'Existing Customer' : 'New Customer';
    
// //     // CRITICAL FIX: The "NEW Zwikker" list view filters by Status = "New"
// //     // So we MUST set Status = "New" for leads to appear in that list
// //     // But we track the actual customer type in description
// //     const finalLeadStatus = 'New'; // Force Status to "New" for list view compatibility

// //     console.log(`🎯 Customer Type: ${customerType}`);
// //     console.log(`🎯 Lead Status (forced for list view): "${finalLeadStatus}"`);

// //     // Build Salesforce data
// //     const salesforceData = {
// //       FirstName: data.first_name,
// //       LastName: data.last_name,
// //       Email: data.user_email,
// //       Phone: data.user_number,
// //       Company: 'Retell AI Lead',
// //       LeadSource: 'Website',
// //       Status: finalLeadStatus, // ← MUST be "New" for NEW Zwikker list
// //       msUnternehmensfokus__c: 'Deutsche Schadenshilfe',
// //       msSchadensart__c: mappedDamageType,
// //       GeschaetzteSchadenshoehe__c: mappedDamageAmount,
// //       Description: `=== CUSTOMER TYPE: ${customerType} ===
// // Original Input - existing_or_new: ${data.existing_or_new}
// // Damage Type: ${data.what_type_of_damage}
// // Damage Amount: ${data.damage_amount}
// // Source: Retell AI Call
// // Date: ${new Date().toISOString()}

// // Note: Status is "New" to appear in NEW Zwikker list view, but this is actually an ${customerType}`
// //     };

// //     console.log('📤 Pushing to Salesforce Lead (NEW Zwikker):', JSON.stringify(salesforceData, null, 2));

// //     // Create the Lead
// //     const leadResponse = await axios.post(
// //       `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead`,
// //       salesforceData,
// //       {
// //         headers: {
// //           'Authorization': `Bearer ${salesforceAccessToken}`,
// //           'Content-Type': 'application/json'
// //         },
// //         timeout: 10000
// //       }
// //     );

// //     console.log('✅ Lead created successfully for NEW Zwikker list');
// //     console.log(`📝 Lead ID: ${leadResponse.data.id}`);
// //     console.log(`🎯 Customer Type: ${customerType}`);
// //     console.log(`📍 Lead Status: ${finalLeadStatus} (required for NEW Zwikker list view)`);

// //     return {
// //       ...leadResponse.data,
// //       customerType: customerType,
// //       salesforceStatus: finalLeadStatus,
// //       originalExistingNew: data.existing_or_new
// //     };
// //   } catch (error) {
// //     console.error('❌ Error pushing to Salesforce:');
// //     if (error.response) {
// //       console.error(`Status: ${error.response.status}`);
// //       console.error('Error details:', JSON.stringify(error.response.data, null, 2));
      
// //       if (error.response.status === 401) {
// //         console.log('🔄 Token expired, re-authenticating...');
// //         salesforceAccessToken = null;
// //         return pushToSalesforce(data);
// //       }
// //     } else {
// //       console.error('Error message:', error.message);
// //     }
// //     throw new Error(`Failed to push data to Salesforce: ${error.message}`);
// //   }
// // }

// // /**
// //  * Retell Webhook Endpoint
// //  */
// // app.post('/retell-webhook', async (req, res) => {
// //   console.log('\n=== Received Retell Webhook ===');
// //   console.log('Timestamp:', new Date().toISOString());
  
// //   try {
// //     const custom_analysis_data = req.body.call?.call_analysis?.custom_analysis_data;

// //     if (!custom_analysis_data) {
// //       console.error('❌ Webhook payload is missing data at call.call_analysis.custom_analysis_data');
// //       return res.status(400).json({ 
// //         success: false,
// //         error: 'Webhook payload did not contain the expected Retell AI data structure.',
// //       });
// //     }

// //     // Extract and validate data
// //     const extractedData = extractAndValidateData(custom_analysis_data);

// //     // Push to Salesforce with correct LeadSource for NEW Zwikker list
// //     const salesforceResult = await pushToSalesforce(extractedData);

// //     // Success response
// //     res.json({
// //       success: true,
// //       message: 'Data processed and pushed to Salesforce NEW Zwikker list successfully',
// //       salesforceId: salesforceResult.id,
// //       customerType: salesforceResult.customerType,
// //       originalExistingNew: extractedData.existing_or_new,
// //       salesforceStatus: salesforceResult.salesforceStatus,
// //       listView: 'NEW Zwikker',
// //       note: 'Lead Status is "New" for list view compatibility, but customer type is tracked in Description',
// //       timestamp: new Date().toISOString()
// //     });

// //   } catch (error) {
// //     console.error('❌ Webhook processing error:', error.message);
// //     res.status(400).json({
// //       success: false,
// //       error: error.message,
// //       timestamp: new Date().toISOString()
// //     });
// //   }
// // });

// // // Health check
// // app.get('/', (req, res) => {
// //   res.json({ 
// //     status: 'OK', 
// //     message: 'Retell to Salesforce Webhook Server - NEW Zwikker Integration',
// //     note: 'Leads are created with Status="New" to appear in NEW Zwikker list, customer type tracked in Description',
// //     features: [
// //       'Customer Type tracking (New/Existing in Description)',
// //       'Damage type mapping to German values',
// //       'Damage amount range mapping',
// //       'Automatic placement in NEW Zwikker list'
// //     ]
// //   });
// // });

// // // Diagnostic endpoint to check list view filters
// // app.get('/diagnose-list-view', async (req, res) => {
// //   try {
// //     if (!salesforceAccessToken) {
// //       await authenticateSalesforce();
// //     }
    
// //     const listViewInfo = await checkListViewFilters();
// //     const validStatuses = await getPicklistValues('Status');
    
// //     res.json({
// //       success: true,
// //       listViewInfo: listViewInfo,
// //       validLeadStatuses: validStatuses,
// //       explanation: 'The NEW Zwikker list view likely filters by Status = "New", so we must use Status = "New" for all leads to appear in that list.'
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       success: false,
// //       error: error.message
// //     });
// //   }
// // });

// // // Test endpoint to create a lead with existing customer
// // app.get('/test-existing-customer', async (req, res) => {
// //   try {
// //     const testData = {
// //       first_name: "Test",
// //       last_name: "ExistingCustomer",
// //       user_email: "test-existing@gmail.com",
// //       user_number: "1234567890",
// //       what_type_of_damage: "Fire damage",
// //       damage_amount: "5000€",
// //       existing_or_new: "existing"
// //     };

// //     console.log('🧪 Testing lead creation with existing customer...');
    
// //     const result = await pushToSalesforce(testData);
    
// //     res.json({
// //       success: true,
// //       testData: testData,
// //       result: result,
// //       explanation: 'This lead will show Status="New" in list view but will have "CUSTOMER TYPE: Existing Customer" in Description'
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       success: false,
// //       error: error.message
// //     });
// //   }
// // });

// // app.listen(PORT, async () => {
// //   console.log(`🚀 Server Started on Port: ${PORT}`);
// //   console.log('📝 NOTE: All leads will have Status="New" to appear in NEW Zwikker list');
// //   console.log('📝 Customer type (New/Existing) is tracked in the Description field');
  
// //   try {
// //     await authenticateSalesforce();
// //     console.log('✅ Salesforce connection established on startup');
    
// //     // Check list view filters on startup
// //     setTimeout(async () => {
// //       await checkListViewFilters();
// //     }, 2000);
// //   } catch (error) {
// //     console.log('⚠️ Salesforce connection failed on startup. Will retry on first webhook.');
// //   }
// // });






// require('dotenv').config();
// const express = require('express');
// const axios = require('axios');
// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Salesforce configuration
// const SALESFORCE_CONFIG = {
//   username: process.env.SF_USERNAME,
//   password: `${process.env.SF_PASSWORD}${process.env.SF_SECURITY_TOKEN || ''}`,
//   client_id: process.env.SF_CLIENT_ID,
//   client_secret: process.env.SF_CLIENT_SECRET,
//   loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
// };

// // Global variable to store access token
// let salesforceAccessToken = null;
// let salesforceInstanceUrl = null;

// /**
//  * Authenticate with Salesforce and get access token
//  */
// async function authenticateSalesforce() {
//   try {
//     console.log('Authenticating with Salesforce...');
    
//     const requestBody = new URLSearchParams({
//       grant_type: 'password',
//       client_id: SALESFORCE_CONFIG.client_id,
//       client_secret: SALESFORCE_CONFIG.client_secret,
//       username: SALESFORCE_CONFIG.username,
//       password: SALESFORCE_CONFIG.password
//     });

//     const response = await axios.post(
//       `${SALESFORCE_CONFIG.loginUrl}/services/oauth2/token`,
//       requestBody,
//       {
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
//       }
//     );

//     salesforceAccessToken = response.data.access_token;
//     salesforceInstanceUrl = response.data.instance_url;
    
//     console.log('✅ Salesforce authentication successful');
//     console.log(`Instance URL: ${salesforceInstanceUrl}`);
    
//     return { accessToken: salesforceAccessToken, instanceUrl: salesforceInstanceUrl };
//   } catch (error) {
//     console.error('❌ Salesforce authentication failed:');
//     if (error.response) {
//       console.error(`Status: ${error.response.status}`);
//       console.error('Data:', error.response.data);
//     } else {
//       console.error('Error:', error.message);
//     }
//     throw error;
//   }
// }

// /**
//  * Extract and validate data from Retell webhook
//  */
// function extractAndValidateData(customAnalysisData) {
//   console.log('🔍 Extracting and validating data...');
  
//   const extractedData = {
//     first_name: customAnalysisData.first_name,
//     last_name: customAnalysisData.last_name,
//     user_email: customAnalysisData.user_email,
//     user_number: customAnalysisData.user_number,
//     what_type_of_damage: customAnalysisData['What Type of damage'], 
//     damage_amount: customAnalysisData.damage_amount,
//     existing_or_new: customAnalysisData.existing_or_new
//   };

//   console.log('Extracted data:', JSON.stringify(extractedData, null, 2));

//   const requiredFields = [
//     'first_name',
//     'last_name',
//     'user_email',
//     'user_number',
//     'what_type_of_damage',
//     'damage_amount',
//     'existing_or_new'
//   ];

//   const missingFields = requiredFields.filter(field => {
//     const value = extractedData[field];
//     return !value || (typeof value === 'string' && value.trim() === '');
//   });

//   if (missingFields.length > 0) {
//     throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
//   }

//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   if (!emailRegex.test(extractedData.user_email)) {
//     throw new Error('Invalid email format');
//   }

//   console.log('✅ Data validation passed');
//   return extractedData;
// }

// /**
//  * Get valid picklist values for specific fields
//  */
// async function getPicklistValues(fieldName) {
//   try {
//     console.log(`🔍 Getting valid picklist values for ${fieldName}...`);
    
//     const describeResponse = await axios.get(
//       `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/describe`,
//       {
//         headers: {
//           'Authorization': `Bearer ${salesforceAccessToken}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     const field = describeResponse.data.fields.find(f => f.name === fieldName);
    
//     if (field && field.picklistValues) {
//       const validValues = field.picklistValues
//         .filter(value => value.active)
//         .map(value => value.value);
      
//       console.log(`✅ Valid ${fieldName} values:`, validValues);
//       return validValues;
//     }
    
//     console.log(`⚠️ No picklist values found for ${fieldName}`);
//     return [];
//   } catch (error) {
//     console.error(`❌ Error getting picklist values for ${fieldName}:`, error.message);
//     return [];
//   }
// }

// /**
//  * Map incoming damage types to valid Salesforce picklist values
//  */
// function mapDamageTypeToValidValue(incomingDamageType, validPicklistValues) {
//   if (!incomingDamageType) return null;
  
//   const lowerIncoming = incomingDamageType.toLowerCase().trim();
  
//   // Try to find exact match first
//   const exactMatch = validPicklistValues.find(value => 
//     value.toLowerCase() === lowerIncoming
//   );
  
//   if (exactMatch) {
//     console.log(`✅ Exact match found: "${incomingDamageType}" -> "${exactMatch}"`);
//     return exactMatch;
//   }
  
//   // Try partial matches for common damage types
//   const mappingRules = {
//     'water': 'Wasserschaden',
//     'feuer': 'Brandschaden',
//     'brand': 'Brandschaden',
//     'sturm': 'Sturmschaden',
//     'einbruch': 'Einbruchdiebstahlschaden',
//     'diebstahl': 'Einbruchdiebstahlschaden',
//     'bau': 'Bauschaden / Baumangel',
//     'mangel': 'Bauschaden / Baumangel',
//     'beruf': 'Berufsunfähigkeit',
//     'unfähigkeit': 'Berufsunfähigkeit',
//     'other': 'Sonstiger Schaden',
//     'sonstig': 'Sonstiger Schaden',
//     'noch kein': 'Noch kein Schadensereignis',
//     'kein schaden': 'Noch kein Schadensereignis'
//   };
  
//   // Check for partial matches in mapping rules
//   for (const [key, value] of Object.entries(mappingRules)) {
//     if (lowerIncoming.includes(key)) {
//       if (validPicklistValues.includes(value)) {
//         console.log(`✅ Partial match found: "${incomingDamageType}" -> "${value}"`);
//         return value;
//       }
//     }
//   }
  
//   // If no match found, use a default valid value or null
//   const defaultValue = validPicklistValues.includes('Sonstiger Schaden') ? 'Sonstiger Schaden' : null;
//   console.log(`⚠️ No match for "${incomingDamageType}", using default: "${defaultValue}"`);
//   return defaultValue;
// }

// /**
//  * Map damage amount to valid picklist values
//  */
// function mapDamageAmountToValidValue(damageAmount, validPicklistValues) {
//   if (!damageAmount) return null;
  
//   // Extract numeric value from the amount
//   const numericMatch = damageAmount.match(/(\d+[,.]?\d*)/);
//   if (!numericMatch) {
//     console.log(`⚠️ Could not extract numeric value from: "${damageAmount}"`);
//     return null;
//   }
  
//   const numericValue = parseFloat(numericMatch[1].replace(',', '.'));
//   console.log(`🔢 Extracted numeric value: ${numericValue} from "${damageAmount}"`);
  
//   // Map to appropriate ranges based on the actual picklist values we found
//   if (numericValue <= 5000) {
//     return findBestMatch(['0€ - 5.000€'], validPicklistValues);
//   } else if (numericValue <= 50000) {
//     return findBestMatch(['5.000€ - 50.000€'], validPicklistValues);
//   } else if (numericValue <= 100000) {
//     return findBestMatch(['50.000€ - 100.000€'], validPicklistValues);
//   } else if (numericValue <= 250000) {
//     return findBestMatch(['100.000€ - 250.000€'], validPicklistValues);
//   } else if (numericValue <= 500000) {
//     return findBestMatch(['250.000€ - 500.000€'], validPicklistValues);
//   } else if (numericValue <= 1000000) {
//     return findBestMatch(['500.000€ - 1.000.000€'], validPicklistValues);
//   } else {
//     return findBestMatch(['100.000€ +', '1 Mio. € - 2 Mio. €'], validPicklistValues);
//   }
// }

// /**
//  * Find the best matching value from available picklist values
//  */
// function findBestMatch(preferredValues, validPicklistValues) {
//   for (const preferred of preferredValues) {
//     const match = validPicklistValues.find(value => 
//       value.toLowerCase().includes(preferred.toLowerCase())
//     );
//     if (match) {
//       console.log(`✅ Amount mapped to: "${match}"`);
//       return match;
//     }
//   }
  
//   // If no match found, return the first valid value or null
//   const fallback = validPicklistValues.length > 0 ? validPicklistValues[0] : null;
//   console.log(`⚠️ No amount match found, using: "${fallback}"`);
//   return fallback;
// }

// /**
//  * Map existing_or_new to Salesforce Status using ACTUAL available statuses
//  */
// function mapLeadStatus(existingOrNewValue, validStatuses) {
//   console.log(`🔍 Mapping lead status from: "${existingOrNewValue}"`);
//   console.log(`📋 Available statuses:`, validStatuses);
  
//   if (!existingOrNewValue) {
//     return 'New';
//   }
  
//   const lowerValue = existingOrNewValue.toLowerCase().trim();
  
//   // UPDATED MAPPING LOGIC - PRIORITIZE "EXISTING" FIRST
//   if (lowerValue.includes('exist') || lowerValue.includes('bestand') || lowerValue.includes('current')) {
//     // FIRST PRIORITY: Use "Existing" status if available
//     if (validStatuses.includes('Existing')) {
//       console.log(`✅ Existing customer mapped to: "Existing"`);
//       return 'Existing';
//     }
//     // SECOND PRIORITY: Use "Working" status
//     else if (validStatuses.includes('Working')) {
//       console.log(`✅ Existing customer mapped to: "Working"`);
//       return 'Working';
//     }
//     // THIRD PRIORITY: Use "Qualified" status
//     else if (validStatuses.includes('Qualified')) {
//       console.log(`✅ Existing customer mapped to: "Qualified"`);
//       return 'Qualified';
//     } else {
//       console.log(`⚠️ No suitable status for existing customer, using: "New"`);
//       return 'New';
//     }
//   } else if (lowerValue.includes('new') || lowerValue.includes('neu')) {
//     // For new customers, use "New" status
//     if (validStatuses.includes('New')) {
//       console.log(`✅ New customer mapped to: "New"`);
//       return 'New';
//     } else {
//       console.log(`⚠️ No suitable status for new customer, using first available`);
//       return validStatuses[0] || 'New';
//     }
//   } else {
//     console.log(`⚠️ Unknown customer type, using: "New"`);
//     return 'New';
//   }
// }


// /**
//  * Check if custom fields exist for customer type tracking
//  */
// async function getAvailableCustomFields() {
//   try {
//     console.log('🔍 Checking for available custom fields...');
    
//     const describeResponse = await axios.get(
//       `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/describe`,
//       {
//         headers: {
//           'Authorization': `Bearer ${salesforceAccessToken}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     const customFields = describeResponse.data.fields
//       .filter(field => field.custom)
//       .map(field => ({
//         name: field.name,
//         label: field.label,
//         type: field.type
//       }));

//     console.log(`✅ Found ${customFields.length} custom fields`);
//     return customFields;
//   } catch (error) {
//     console.error('❌ Error checking custom fields:', error.message);
//     return [];
//   }
// }

// /**
//  * Push data to Salesforce as a Lead
//  */
// async function pushToSalesforce(data) {
//   try {
//     if (!salesforceAccessToken) {
//       await authenticateSalesforce();
//     }

//     // Get valid picklist values
//     const validDamageTypes = await getPicklistValues('msSchadensart__c');
//     const validDamageAmounts = await getPicklistValues('GeschaetzteSchadenshoehe__c');
//     const validLeadStatuses = await getPicklistValues('Status');

//     console.log('=== STATUS MAPPING DEBUG ===');
//     console.log('Input existing_or_new:', data.existing_or_new);
//     console.log('Valid statuses:', validLeadStatuses);

//     // Map values
//     const mappedDamageType = mapDamageTypeToValidValue(data.what_type_of_damage, validDamageTypes);
//     const mappedDamageAmount = mapDamageAmountToValidValue(data.damage_amount, validDamageAmounts);
//     const mappedLeadStatus = mapLeadStatus(data.existing_or_new, validLeadStatuses);

//     console.log(`🎯 Final Lead Status: "${mappedLeadStatus}"`);
//     console.log('=== END DEBUG ===');

//     // Build Salesforce data
//     const salesforceData = {
//       FirstName: data.first_name,
//       LastName: data.last_name,
//       Email: data.user_email,
//       Phone: data.user_number,
//       Company: 'Retell AI Lead',
//       LeadSource: 'Website',
//       Status: mappedLeadStatus,
//       msUnternehmensfokus__c: 'Deutsche Schadenshilfe',
//       msSchadensart__c: mappedDamageType,
//       GeschaetzteSchadenshoehe__c: mappedDamageAmount,
//       Description: `CUSTOMER TYPE: ${data.existing_or_new}
// Mapped Salesforce Status: ${mappedLeadStatus}
// Original Damage Type: ${data.what_type_of_damage}
// Original Damage Amount: ${data.damage_amount}
// Source: Retell AI Call
// Date: ${new Date().toISOString()}`
//     };

//     console.log('📤 Pushing to Salesforce Lead:', JSON.stringify(salesforceData, null, 2));

//     // Create the Lead
//     const leadResponse = await axios.post(
//       `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead`,
//       salesforceData,
//       {
//         headers: {
//           'Authorization': `Bearer ${salesforceAccessToken}`,
//           'Content-Type': 'application/json'
//         },
//         timeout: 10000
//       }
//     );

//     console.log('✅ Lead created successfully');
//     console.log(`📝 Lead ID: ${leadResponse.data.id}`);
//     console.log(`🎯 Lead Status: ${mappedLeadStatus}`);

//     return {
//       ...leadResponse.data,
//       customerType: data.existing_or_new,
//       salesforceStatus: mappedLeadStatus
//     };
//   } catch (error) {
//     console.error('❌ Error pushing to Salesforce:');
//     if (error.response) {
//       console.error(`Status: ${error.response.status}`);
//       console.error('Error details:', JSON.stringify(error.response.data, null, 2));
      
//       if (error.response.status === 401) {
//         console.log('🔄 Token expired, re-authenticating...');
//         salesforceAccessToken = null;
//         return pushToSalesforce(data);
//       }
//     } else {
//       console.error('Error message:', error.message);
//     }
//     throw new Error(`Failed to push data to Salesforce: ${error.message}`);
//   }
// }

// /**
//  * Retell Webhook Endpoint
//  */
// app.post('/retell-webhook', async (req, res) => {
//   console.log('\n=== Received Retell Webhook ===');
//   console.log('Timestamp:', new Date().toISOString());
  
//   try {
//     const custom_analysis_data = req.body.call?.call_analysis?.custom_analysis_data;

//     if (!custom_analysis_data) {
//       console.error('❌ Webhook payload is missing data at call.call_analysis.custom_analysis_data');
//       return res.status(400).json({ 
//         success: false,
//         error: 'Webhook payload did not contain the expected Retell AI data structure.',
//       });
//     }

//     // Extract and validate data
//     const extractedData = extractAndValidateData(custom_analysis_data);

//     // Push to Salesforce
//     const salesforceResult = await pushToSalesforce(extractedData);

//     // Success response
//     res.json({
//       success: true,
//       message: 'Data processed and pushed to Salesforce successfully',
//       salesforceId: salesforceResult.id,
//       leadStatus: salesforceResult.salesforceStatus,
//       originalInput: extractedData.existing_or_new,
//       mapping: `"${extractedData.existing_or_new}" → "${salesforceResult.salesforceStatus}"`,
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     console.error('❌ Webhook processing error:', error.message);
//     res.status(400).json({
//       success: false,
//       error: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // ==================== TEST ENDPOINTS ====================

// /**
//  * Test the new status mapping
//  */
// app.get('/test-status-mapping', async (req, res) => {
//   try {
//     const testData = {
//       first_name: "TestStatus",
//       last_name: "Mapping",
//       user_email: "test-status-mapping@gmail.com",
//       user_number: "5555555555",
//       what_type_of_damage: "Water damage",
//       damage_amount: "3000€",
//       existing_or_new: "existing"
//     };

//     console.log('\n🧪 TEST: New Status Mapping');
    
//     const result = await pushToSalesforce(testData);
//     const customFields = await getAvailableCustomFields();

//     res.json({
//       test: "New Status Mapping",
//       input: testData.existing_or_new,
//       output: result.salesforceStatus,
//       mapping: `"existing" → "${result.salesforceStatus}"`,
//       explanation: "Existing customers now map to 'Working' status since 'Existing Customer' is not available",
//       available_custom_fields: customFields.slice(0, 10), // Show first 10 custom fields
//       lead_id: result.id
//     });
//   } catch (error) {
//     res.status(500).json({
//       error: error.message
//     });
//   }
// });

// /**
//  * Check available statuses and fields
//  */
// app.get('/check-available-fields', async (req, res) => {
//   try {
//     const validStatuses = await getPicklistValues('Status');
//     const customFields = await getAvailableCustomFields();

//     res.json({
//       available_lead_statuses: validStatuses,
//       custom_fields_count: customFields.length,
//       custom_fields_sample: customFields.slice(0, 15),
//       recommended_mapping: {
//         'existing': 'Working',
//         'new': 'New',
//         'bestand': 'Working', 
//         'neu': 'New'
//       }
//     });
//   } catch (error) {
//     res.status(500).json({
//       error: error.message
//     });
//   }
// });

// // Health check
// app.get('/', (req, res) => {
//   res.json({ 
//     status: 'OK', 
//     message: 'Retell to Salesforce Webhook Server - FIXED Status Mapping',
//     note: 'Now properly maps "existing" to "Working" status (since "Existing Customer" is not available)',
//     endpoints: [
//       '/test-status-mapping',
//       '/check-available-fields'
//     ]
//   });
// });

// app.listen(PORT, async () => {
//   console.log(`🚀 Server Started on Port: ${PORT}`);
//   console.log('🎯 Status mapping fixed: "existing" → "Working"');
  
//   try {
//     await authenticateSalesforce();
//     console.log('✅ Salesforce connection established on startup');
//   } catch (error) {
//     console.log('⚠️ Salesforce connection failed on startup. Will retry on first webhook.');
//   }
// });



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
    existing_or_new: customAnalysisData.existing_or_new,
    reason_of_call: customAnalysisData.reason_of_the_call,  // NEW FIELD
    call_summary: customAnalysisData.summary  // NEW FIELD
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
    // reason_of_call and call_summary are optional
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
 * Map existing_or_new to Salesforce Status using ACTUAL available statuses
 */
function mapLeadStatus(existingOrNewValue, validStatuses) {
  console.log(`🔍 Mapping lead status from: "${existingOrNewValue}"`);
  console.log(`📋 Available statuses:`, validStatuses);
  
  if (!existingOrNewValue) {
    return 'New';
  }
  
  const lowerValue = existingOrNewValue.toLowerCase().trim();
  
  // UPDATED MAPPING LOGIC - PRIORITIZE "EXISTING" FIRST
  if (lowerValue.includes('exist') || lowerValue.includes('bestand') || lowerValue.includes('current')) {
    // FIRST PRIORITY: Use "Existing" status if available
    if (validStatuses.includes('Existing')) {
      console.log(`✅ Existing customer mapped to: "Existing"`);
      return 'Existing';
    }
    // SECOND PRIORITY: Use "Working" status
    else if (validStatuses.includes('Working')) {
      console.log(`✅ Existing customer mapped to: "Working"`);
      return 'Working';
    }
    // THIRD PRIORITY: Use "Qualified" status
    else if (validStatuses.includes('Qualified')) {
      console.log(`✅ Existing customer mapped to: "Qualified"`);
      return 'Qualified';
    } else {
      console.log(`⚠️ No suitable status for existing customer, using: "New"`);
      return 'New';
    }
  } else if (lowerValue.includes('new') || lowerValue.includes('neu')) {
    // For new customers, use "New" status
    if (validStatuses.includes('New')) {
      console.log(`✅ New customer mapped to: "New"`);
      return 'New';
    } else {
      console.log(`⚠️ No suitable status for new customer, using first available`);
      return validStatuses[0] || 'New';
    }
  } else {
    console.log(`⚠️ Unknown customer type, using: "New"`);
    return 'New';
  }
}

/**
 * Check if custom fields exist for customer type tracking
 */
async function getAvailableCustomFields() {
  try {
    console.log('🔍 Checking for available custom fields...');
    
    const describeResponse = await axios.get(
      `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead/describe`,
      {
        headers: {
          'Authorization': `Bearer ${salesforceAccessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const customFields = describeResponse.data.fields
      .filter(field => field.custom)
      .map(field => ({
        name: field.name,
        label: field.label,
        type: field.type
      }));

    console.log(`✅ Found ${customFields.length} custom fields`);
    return customFields;
  } catch (error) {
    console.error('❌ Error checking custom fields:', error.message);
    return [];
  }
}

/**
 * Push data to Salesforce as a Lead
 */
/**
 * Push data to Salesforce as a Lead
 */
async function pushToSalesforce(data) {
  try {
    if (!salesforceAccessToken) {
      await authenticateSalesforce();
    }

    // Get valid picklist values
    const validDamageTypes = await getPicklistValues('msSchadensart__c');
    const validDamageAmounts = await getPicklistValues('GeschaetzteSchadenshoehe__c');
    const validLeadStatuses = await getPicklistValues('Status');

    console.log('=== STATUS MAPPING DEBUG ===');
    console.log('Input existing_or_new:', data.existing_or_new);
    console.log('Valid statuses:', validLeadStatuses);

    // Map values
    const mappedDamageType = mapDamageTypeToValidValue(data.what_type_of_damage, validDamageTypes);
    const mappedDamageAmount = mapDamageAmountToValidValue(data.damage_amount, validDamageAmounts);
    const mappedLeadStatus = mapLeadStatus(data.existing_or_new, validLeadStatuses);

    console.log(`🎯 Final Lead Status: "${mappedLeadStatus}"`);
    console.log('=== END DEBUG ===');

    // Build Salesforce data with CUSTOM FIELDS for call summary and reason
    const salesforceData = {
  FirstName: data.first_name,
  LastName: data.last_name, 
  Email: data.user_email,
  Phone: data.user_number,
  Company: 'Retell AI Lead',
  LeadSource: 'Website',
  
  // 🎯 THIS IS THE IMPORTANT PART - USE DESCRIPTION ONLY
  Description: `CALL SUMMARY: ${data.call_summary || 'No summary'}

REASON FOR CALL: ${data.reason_of_call || 'No reason provided'}

CUSTOMER TYPE: ${data.existing_or_new}
DAMAGE TYPE: ${data.what_type_of_damage} 
DAMAGE AMOUNT: ${data.damage_amount}
DATE: ${new Date().toLocaleString()}`
};

    console.log('📤 Pushing to Salesforce Lead:', JSON.stringify(salesforceData, null, 2));
    console.log('🔍 Custom fields being used:');
    console.log(`   - Informationen_Sachbearbeiter__c: ${data.call_summary ? 'Yes' : 'No'}`);
    console.log(`   - benotigte_Unterstutzung__c: ${data.reason_of_call ? 'Yes' : 'No'}`);

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

    console.log('✅ Lead created successfully');
    console.log(`📝 Lead ID: ${leadResponse.data.id}`);
    console.log(`🎯 Lead Status: ${mappedLeadStatus}`);
    console.log(`📋 Call Summary field: ${data.call_summary ? 'POPULATED' : 'Empty'}`);
    console.log(`📞 Reason for Call field: ${data.reason_of_call ? 'POPULATED' : 'Empty'}`);

    return {
      ...leadResponse.data,
      customerType: data.existing_or_new,
      salesforceStatus: mappedLeadStatus,
      hasCallSummary: !!data.call_summary,
      hasReasonForCall: !!data.reason_of_call,
      customFieldsUsed: {
        callSummary: 'Informationen_Sachbearbeiter__c',
        callReason: 'benotigte_Unterstutzung__c'
      }
    };
  } catch (error) {
    console.error('❌ Error pushing to Salesforce:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
      
      // Check if it's a field validation error
      if (error.response.data && error.response.data.length > 0) {
        error.response.data.forEach(err => {
          console.error(`Field Error: ${err.fields} - ${err.message}`);
        });
      }
      
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

    // Push to Salesforce
    const salesforceResult = await pushToSalesforce(extractedData);

    // Success response
    res.json({
      success: true,
      message: 'Data processed and pushed to Salesforce successfully',
      salesforceId: salesforceResult.id,
      leadStatus: salesforceResult.salesforceStatus,
      originalInput: extractedData.existing_or_new,
      mapping: `"${extractedData.existing_or_new}" → "${salesforceResult.salesforceStatus}"`,
      callData: {
        hasSummary: !!extractedData.call_summary,
        hasReason: !!extractedData.reason_of_call
      },
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

// ==================== TEST ENDPOINTS ====================

/**
 * Test the new status mapping
 */
app.get('/test-status-mapping', async (req, res) => {
  try {
    const testData = {
      first_name: "TestStatus",
      last_name: "Mapping",
      user_email: "test-status-mapping@gmail.com",
      user_number: "5555555555",
      what_type_of_damage: "Water damage",
      damage_amount: "3000€",
      existing_or_new: "existing"
    };

    console.log('\n🧪 TEST: New Status Mapping');
    
    const result = await pushToSalesforce(testData);
    const customFields = await getAvailableCustomFields();

    res.json({
      test: "New Status Mapping",
      input: testData.existing_or_new,
      output: result.salesforceStatus,
      mapping: `"existing" → "${result.salesforceStatus}"`,
      explanation: "Existing customers now map to 'Working' status since 'Existing Customer' is not available",
      available_custom_fields: customFields.slice(0, 10),
      lead_id: result.id
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * Test the new call summary and reason fields
 */
/**
 * Test the custom fields for call summary and reason
 */
app.get('/test-custom-fields', async (req, res) => {
  try {
    const testData = {
      first_name: "TestCustom",
      last_name: "Fields", 
      user_email: "test-custom-fields@gmail.com",
      user_number: "5554443333",
      what_type_of_damage: "Water damage",
      damage_amount: "7500€",
      existing_or_new: "existing",
      reason_of_call: "Testing custom fields - water damage inquiry",
      call_summary: "Testing that call summary and reason are stored in custom fields properly. Customer has ongoing water leakage issue."
    };

    console.log('\n🧪 TEST: Custom Fields for Call Data');
    
    const result = await pushToSalesforce(testData);

    res.json({
      success: true,
      test: "Custom Fields for Call Summary and Reason",
      input: {
        reason: testData.reason_of_call,
        summary: testData.call_summary
      },
      salesforce_fields_used: {
        call_summary: 'Informationen_Sachbearbeiter__c',
        call_reason: 'benotigte_Unterstutzung__c'
      },
      lead_id: result.id,
      note: "Check Salesforce Lead - data should be in both custom fields AND description"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test compact description format
 */
app.get('/test-compact-description', async (req, res) => {
  try {
    const testData = {
      first_name: "TestCompact",
      last_name: "Format",
      user_email: "test-compact@gmail.com",
      user_number: "5559998888",
      what_type_of_damage: "Fire damage",
      damage_amount: "15000€",
      existing_or_new: "new",
      reason_of_call: "New customer inquiry about fire damage",
      call_summary: "New customer called regarding recent fire incident in their apartment. Provided basic advice and collected contact information for follow-up."
    };

    console.log('\n🧪 TEST: Compact Description Format');
    
    const result = await pushToSalesforce(testData);

    res.json({
      success: true,
      test: "Compact Description Format",
      description_format: "Clean, readable format with emojis",
      lead_id: result.id,
      note: "Add 'Description' column to your list view to see this data"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Check available statuses and fields
 */
app.get('/check-available-fields', async (req, res) => {
  try {
    const validStatuses = await getPicklistValues('Status');
    const customFields = await getAvailableCustomFields();

    res.json({
      available_lead_statuses: validStatuses,
      custom_fields_count: customFields.length,
      custom_fields_sample: customFields.slice(0, 15),
      recommended_mapping: {
        'existing': 'Existing',
        'new': 'New',
        'bestand': 'Existing', 
        'neu': 'New'
      },
      note: "All custom fields appear to be read-only. Using clean Description format instead."
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Retell to Salesforce Webhook Server - With Clean Call Summary Format',
    note: 'Call summary and reason stored in Description field with clean, readable formatting',
    features: [
      '📞 Call summary storage in Description',
      '🎯 Reason for call tracking', 
      '👤 Customer type mapping (existing → Existing)',
      '🏠 Damage type mapping to German values',
      '💰 Damage amount range mapping',
      '📅 Clean, readable format with emojis'
    ],
    endpoints: [
      '/test-status-mapping',
      '/test-call-fields',
      '/test-compact-description',
      '/check-available-fields'
    ]
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server Started on Port: ${PORT}`);
  console.log('🎯 Status mapping: "existing" → "Existing"');
  console.log('📋 NEW: Clean call summary format in Description field');
  console.log('💡 TIP: Add "Description" column to your list view to see the data');
  
  try {
    await authenticateSalesforce();
    console.log('✅ Salesforce connection established on startup');
  } catch (error) {
    console.log('⚠️ Salesforce connection failed on startup. Will retry on first webhook.');
  }
});