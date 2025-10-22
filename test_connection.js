require('dotenv').config();
const axios = require('axios');

async function testConnection() {
  console.log('Testing connection to local server...\n');
  
  try {
    // Test server health
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('✅ Server health:', healthResponse.data);
    
    // Test Salesforce connection
    const sfResponse = await axios.get('http://localhost:3000/test-sf-connection');
    console.log('✅ Salesforce connection:', sfResponse.data);
    
    console.log('\n🎉 All tests passed! Your server is ready.');
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.code === 'ECONNREFUSED') {
      console.log('Server is not running. Start it with: npm run dev');
    } else {
      console.error(error.response?.data || error.message);
    }
  }
}

testConnection();