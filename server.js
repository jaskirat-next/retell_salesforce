require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SALESFORCE_CONFIG = {
  username: process.env.SF_USERNAME,
  password: `${process.env.SF_PASSWORD}${process.env.SF_SECURITY_TOKEN || ""}`,
  client_id: process.env.SF_CLIENT_ID,
  client_secret: process.env.SF_CLIENT_SECRET,
  loginUrl: process.env.SF_LOGIN_URL || "https://login.salesforce.com",
};

let salesforceAccessToken = null;
let salesforceInstanceUrl = null;

async function authenticateSalesforce() {
  try {
    console.log("Authenticating with Salesforce...");
    const requestBody = new URLSearchParams({
      grant_type: "password",
      client_id: SALESFORCE_CONFIG.client_id,
      client_secret: SALESFORCE_CONFIG.client_secret,
      username: SALESFORCE_CONFIG.username,
      password: SALESFORCE_CONFIG.password,
    });
    const response = await axios.post(
      `${SALESFORCE_CONFIG.loginUrl}/services/oauth2/token`,
      requestBody,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    salesforceAccessToken = response.data.access_token;
    salesforceInstanceUrl = response.data.instance_url;
    console.log("✅ Salesforce authentication successful");
    return {
      accessToken: salesforceAccessToken,
      instanceUrl: salesforceInstanceUrl,
    };
  } catch (error) {
    console.error(
      "❌ Salesforce authentication failed:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

async function pushToSalesforce(data) {
  try {
    if (!salesforceAccessToken) {
      await authenticateSalesforce();
    }
    const salesforceData = {
      FirstName: data.first_name,
      LastName: data.last_name,
      Email: data.user_email,
      Phone: data.user_number,
      Company: "Retell AI Lead",
      LeadSource: "Retell AI",
      Status: "New",
      Damage_Type__c: data.what_type_of_damage,
      Damage_Amount__c: data.damage_amount,
      Existing_or_New__c: data.existing_or_new,
    };
    console.log(
      "📤 Pushing to Salesforce Lead:",
      JSON.stringify(salesforceData, null, 2)
    );
    const leadResponse = await axios.post(
      `${salesforceInstanceUrl}/services/data/v58.0/sobjects/Lead`,
      salesforceData,
      {
        headers: {
          Authorization: `Bearer ${salesforceAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(
      `✅ Lead created successfully with ID: ${leadResponse.data.id}`
    );
    return leadResponse.data;
  } catch (error) {
    console.error(
      "❌ Error pushing to Salesforce:",
      error.response ? error.response.data : error.message
    );
    if (error.response && error.response.status === 401) {
      console.log("🔄 Token expired, re-authenticating...");
      salesforceAccessToken = null;
      return pushToSalesforce(data);
    }
    throw error;
  }
}

function extractAndValidateData(customAnalysisData) {
  console.log("🔍 Validating data...");
  const requiredFields = [
    "first_name",
    "last_name",
    "user_email",
    "user_number",
    "What Type of damage",
    "damage_amount",
    "existing_or_new",
  ];

  const missingFields = requiredFields.filter((field) => {
    // THIS IS THE FIX: Check the original customAnalysisData object
    const value = customAnalysisData[field];
    return value === null || value === undefined || String(value).trim() === "";
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customAnalysisData.user_email)) {
    throw new Error("Invalid email format");
  }

  const extractedData = {
    first_name: customAnalysisData.first_name,
    last_name: customAnalysisData.last_name,
    user_email: customAnalysisData.user_email,
    user_number: customAnalysisData.user_number,
    what_type_of_damage: customAnalysisData["What Type of damage"],
    damage_amount: customAnalysisData.damage_amount,
    existing_or_new: customAnalysisData.existing_or_new,
  };

  console.log("✅ Data validation passed");
  return extractedData;
}

app.post("/retell-webhook", async (req, res) => {
  console.log("\n=== Received Retell Webhook ===");
  try {
    const custom_analysis_data =
      req.body.call?.call_analysis?.custom_analysis_data;
    if (!custom_analysis_data) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Webhook payload did not contain expected Retell data structure.",
        });
    }
    const extractedData = extractAndValidateData(custom_analysis_data);
    const salesforceResult = await pushToSalesforce(extractedData);
    res.json({
      success: true,
      message: "Data pushed to Salesforce successfully",
      salesforceId: salesforceResult.id,
    });
  } catch (error) {
    console.error("❌ Webhook processing error:", error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/", (req, res) => res.json({ status: "OK" }));

app.listen(PORT, async () => {
  console.log(`🚀 Server Started on Port: ${PORT}`);
  try {
    await authenticateSalesforce();
  } catch (error) {
    console.log(
      "⚠️ Salesforce connection failed on startup. Will retry on first webhook."
    );
  }
});
