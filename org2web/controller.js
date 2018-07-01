var express = require('express');
var app = express();

var bodyParser = require('body-parser');
var http = require('http');
var fs = require('fs');
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');

const basePath = path.resolve(__dirname, './certs');
const readCryptoFile = filename => fs.readFileSync(path.resolve(basePath, filename)).toString();

module.exports = (function() {
  return {
    get_all_record: function(req, res) {
      console.log("Getting all records from database");

      var fabric_client = new Fabric_Client();

      var channel = fabric_client.newChannel('mychannel');
      var peer = fabric_client.newPeer('grpcs://localhost:7051', {
        pem: readCryptoFile('peer1.pem'),
        'ssl-target-name-override': 'peer1.org1.example.com'
      });

      var member_user = null;
      var store_path = path.join(os.homedir(), '.hfc-key-store');
      console.log('Store path: ' + store_path);
      var tx_id = null;

      Fabric_Client.newDefaultKeyValueStore({ path: store_path
      }).then((state_store) => {
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();

        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        return fabric_client.getUserContext('user1', 'true');
      }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
          console.log('Successfully loaded user1 from persistence');
          member_user = user_from_store;
        } else {
          throw new Error('Failed to get user1, run enrollUser.js');
        }

        const request = {
          chaincodeId: 'peoplechain',
          txId: tx_id,
          fcn: 'queryAllRecord',
          args: ['']
        };

        return channel.queryByChaincode(request);
      }).then((query_responses) => {
        console.log('Query has completed, checking results');

        if (query_responses && query_responses.length == 1) {
          if (query_responses[0] instanceof Error) {
            console.error('Error from query = ' + query_responses[0]);
          } else {
            console.log("Response is ", query_responses[0].toString());
            res.json(JSON.parse(query_responses[0].toString()));
          }
        } else {
          console.log("No payloads were returned from the query");
        }
      }).catch((err) => {
        console.error('Failed to query successfully :: ' + err);
      });
    },
    add_record: function(req, res){
      console.log("Submit record");

      var array = req.params.record.split("-");
      console.log(array);

      var key = array[0];
      var timestamp
    }
  }
})
