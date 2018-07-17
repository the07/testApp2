var express       = require('express');        // call express
var app           = express();                 // define our app using express
var bodyParser    = require('body-parser');
var http          = require('http')
var fs            = require('fs');
var Fabric_Client = require('fabric-client');
var path          = require('path');
var util          = require('util');
var os            = require('os');

module.exports = (function() {
  return {
    get_all_record: function(req, res) {
      console.log("Getting all records from the databse");

      const basePath = path.resolve(__dirname, './certs');
      const readCryptoFile = filename => fs.readFileSync(path.resolve(basePath, filename)).toString();

      var fabric_client = new Fabric_Client();

      var channel = fabric_client.newChannel('mychannel');
      var peer = fabric_client.newPeer('grpcs://localhost:7051', {
        pem: readCryptoFile('peer1.pem'),
        'ssl-target-name-override': 'peer0.org1.example.com'
      });
      channel.addPeer(peer);

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

        return fabric_client.getUserContext('user1', true);
      }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
          console.log("Successfully loaded user1 from persistence");
          member_user = user_from_store;
        } else {
          throw new Error("Failed to get user, register user.")
        }

        const request = {
          chaincodeId: 'peoplechain',
          txId: tx_id,
          fcn: 'queryAllRecord',
          args: ['']
        };

        return channel.queryByChaincode(request);
      }).then((query_responses) => {
        console.log('Query has completed checking results');

        if (query_responses && query_responses.length == 1) {
          if (query_responses[0] instanceof Error) {
            consoe.error("Error from query: ", query_responses[0]);
          } else {
            console.log("Response is ", query_responses[0].toString());
            res.json(JSON.parse(query_responses[0].toString()));
          }
        } else {
          console.log("No payloads were returned from the query")
        }
      }).catch((err) => {
        console.error("Failed to query successfully :: " + err);
      });
    },
    generate_key: function(req, res) {
      console.log("Generating user keys");

      var array = req.params.user.split("-");

      const basePath = path.resolve(__dirname, './certs');
      const readCryptoFile = filename => fs.readFileSync(path.resolve(basePath, filename)).toString();

      var fabric_client = new Fabric_Client();

      var channel = fabric_client.newChannel('mychannel');
      var peer = fabric_client.newPeer('grpcs://localhost:7051', {
        pem: readCryptoFile('peer1.pem'),
        'ssl-target-name-override': 'peer0.org1.example.com'
      });
      channel.addPeer(peer);
      var orderer = fabric_client.newOrderer('grpcs://localhost:7050', {
        pem: readCryptoFile('Orderer.pem'),
        'ssl-target-name-override': 'orderer.example.com'
      });
      channel.addOrderer(orderer);

      var member_user = null;
      var store_path = path.join(os.homedir(), '.hfc-key-store');
      var tx_id = null;

      Fabric_Client.newDefaultKeyValueStore({ path: store_path
      }).then((state_store) => {
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        var crypto_store = Fabric_Client.newCryptoKeyStore({path:store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        return fabric_client.getUserContext('user1', true);
      }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
          console.log('Successfully loaded user1 from persistence');
          member_user = user_from_store;
        } else {
          throw new Error('Failed tp get user1, register user first');
        }

        tx_id = fabric_client.newTransactionID();
        console.log("Assigning transaction id: " + tx_id._transaction_id);

        var request = {
          chaincodeId: 'peoplechain',
          fcn: 'createUser',
          args: ["user1", array[0], array[1]],
          txId: tx_id
        };

        return channel.sendTransactionProposal(request)
      }).then((results) => {
        var proposalResponses = results[0];
        var proposal = results[1];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
          isProposalGood = true;
          console.log('Transaction proposal was good');
          var keys = proposalResponses[0].response.payload.toString();
          console.log(proposalResponses[0].response.payload.toString());
          res.json(JSON.parse(keys));
        } else {
          console.error('Transaction proposal was bad');
        }
        if (isProposalGood) {

          var request = {
            proposalResponses: proposalResponses,
            proposal: proposal
          };

          var transaction_id_string = tx_id.getTransactionID();
          var promises = [];

          var sendPromise = channel.sendTransaction(request);
          promises.push(sendPromise);

          let event_hub = fabric_client.newEventHub();
          event_hub.setPeerAddr('grpcs://localhost:7053', {
            pem: readCryptoFile('peer1.pem'),
            'ssl-target-name-override': 'peer0.org1.example.com'
          });

          let txPromise = new Promise((resolve, reject) => {
            let handle = setTimeout(() => {
              event_hub.disconnect();
              resolve({event_status: 'TIMEOUT'});
            }, 3000);
            event_hub.connect();
            event_hub.registerTxEvent(transaction_id_string, (tx, code) => {

              clearTimeout(handle);
              event_hub.unregisterTxEvent(transaction_id_string);
              event_hub.disconnect();

              var return_status = {event_status: code, tx_id: transaction_id_string};
              if (code !== 'VALID') {
                console.error('The transaction was invalid code = ' + code);
                resolve(return_status);
              } else {
                console.log("The transaction has been committed to peer " + event_hub._ep._endpoint.addr);
                resolve(return_status);
              }
            }, (err) => {
              reject(new Error('There was a problem with the eventhub ::'+err));
            });
          });

          promises.push(txPromise);

          return Promise.all(promises);
        } else {
          console.error('Failed to send Proposal  or receive valid response. Response null or status is not 200, Exiting.');
          throw new Error('Failed to send Proposal or reciee valid response. Response null or status is not 200, Exiting.');
        }
      }).then((results) => {
        console.log('Send transaction promise and event listener promise gave been completed.');

        if (results && results[0] && results[0].status === 'SUCCESS') {
      		console.log('Successfully sent transaction to the orderer.');
      	} else {
      		console.error('Failed to order the transaction. Error code: ' + response.status);
      	}

        if (results && results[1] && results[1].event_status === 'VALID') {
          console.log('Successfully committed the change to the ledger by the peer');
        } else {
          console.log('Transaction failed to be committed to the ledger due to :: ' + results[1].event_status);
        }
      }).catch((err) => {
        console.error("Failed to invoke successfully :: " + err);
      });
    }, 
    create_record: function(req, res) {
      console.log("Creating record");

      var array = req.params.record.split("-");
      const basePath = path.resolve(__dirname, './certs');
      const readCryptoFile = filename => fs.readFileSync(path.resolve(basePath, filename)).toString();

      //
      var fabric_client = new Fabric_Client();

      // setup the fabric network
      var channel = fabric_client.newChannel('mychannel');
      var peer = fabric_client.newPeer('grpcs://localhost:7051', {
        pem: readCryptoFile('peer1.pem'),
        'ssl-target-name-override': 'peer0.org1.example.com'
      });
      channel.addPeer(peer);
      var order = fabric_client.newOrderer('grpcs://localhost:7050', {
        pem: readCryptoFile('Orderer.pem'),
        'ssl-target-name-override': 'orderer.example.com'
      });
      channel.addOrderer(order);

      //
      var member_user = null;
      var store_path = path.join(os.homedir(), '.hfc-key-store');
      console.log('Store path:'+store_path);
      var tx_id = null;

      Fabric_Client.newDefaultKeyValueStore({ path: store_path
      }).then((state_store) => {
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // get the enrolled user from persistence, this user will sign all requests
        return fabric_client.getUserContext('user1', true);
      }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
          console.log('Successfully loaded user1 from persistence.');
          member_user = user_from_store;
        } else {
          throw new Error('Failed to get user1, register User');
        }

        tx_id = fabric_client.newTransactionID();
        console.log("Assigning transaction id: ", tx_id._transaction_id);
        var id = array[0];
        var pubkey = array[1];
        var privkey = array[2];
        var orgkey = array[3];
        var private_data = array[4];
        var public_data = array[5];

        var record = {
          id: id,
          data: {
            public: public_data,
            private: private_data,
          },
        };

        var record_string = JSON.stringify(record);
        var file_name = './user/' + id + '.txt';

        fs.writeFile(file_name, record_string, (err) => {
          if (err) throw err;
          console.log('Record successfully appended to the file.');
        });

        var request = {
          chaincodeId: 'peoplechain',
          fcn: 'createRecord',
          args: [id, pubkey, privkey, orgkey, private_data, public_data],
          txId: tx_id,
        };

        return channel.sendTransactionProposal(request);
      }).then((results) => {
        var proposalResponses = results[0];
        var proposal = results[1];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response &&
          proposalResponses[0].response.status === 200) {
            isProposalGood = true;
            console.log('Transaction proposal was good');
          } else {
            console.error('Transaction proposal was bad');
          }
        if (isProposalGood) {
          console.log(util.format(
            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
            proposalResponses[0].response.status, proposalResponses[0].response.message));

          // build up the request for the orderer to have the transaction committed
          var request = {
            proposalResponses: proposalResponses,
            proposal: proposal
          };

          // set the transaction listener and set a timeout of 30 sec
          // if the transaction did not get committed within the timeout period,
          // report a TIMEOUT status
          var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
          var promises = [];

          var sendPromise = channel.sendTransaction(request);
          promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

          // get an eventhub once the fabric client has a user assigned. The user
          // is required bacause the event registration must be signed
          let event_hub = fabric_client.newEventHub();
          event_hub.setPeerAddr('grpcs://localhost:7053', {
            pem: readCryptoFile('peer1.pem'),
            'ssl-target-name-override': 'peer0.org1.example.com'
          });

          // using resolve the promise so that result status may be processed
          // under the then clause rather than having the catch clause process
          // the status
          let txPromise = new Promise((resolve, reject) => {
            let handle = setTimeout(() => {
              event_hub.disconnect();
              resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
            }, 3000);
            event_hub.connect();
            event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
              // this is the callback for transaction event status
              // first some clean up of event listener
              clearTimeout(handle);
              event_hub.unregisterTxEvent(transaction_id_string);
              event_hub.disconnect();

              // now let the application know what happened
              var return_status = {event_status : code, tx_id : transaction_id_string};
              if (code !== 'VALID') {
                console.error('The transaction was invalid, code = ' + code);
                resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
              } else {
                console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                resolve(return_status);
              }
            }, (err) => {
              //this is the callback if something goes wrong with the event registration or processing
              reject(new Error('There was a problem with the eventhub ::'+err));
            });
          });
          promises.push(txPromise);

          return Promise.all(promises);
        } else {
          console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
          throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
      }).then((results) => {
        console.log('Send transaction promise and event listener promise have completed');
        console.log(results);
        if (results && results[0] && results[0].status === 'SUCCESS') {
          console.log('Successfully sent transaction to the orderer.');
          res.send(tx_id.getTransactionID());
        } else {
          console.error('Failed to order the transaction. Error code: ' + response.status);
        }
      
        if(results && results[1] && results[1].event_status === 'VALID') {
          console.log('Successfully committed the change to the ledger by the peer');
          res.send(tx_id.getTransactionID());
        } else {
          console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
        }

      }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
      });
      
    }, //Next function starts here
    get_record: function(req, res) {

      var key = req.params.id;
      const basePath = path.resolve(__dirname, './certs');
      const readCryptoFile = filename => fs.readFileSync(path.resolve(basePath, filename)).toString();


      var fabric_client = new Fabric_Client();

      var channel = fabric_client.newChannel('mychannel');
      var peer = fabric_client.newPeer('grpcs://localhost:7051', {
        pem: readCryptoFile('peer1.pem'),
        'ssl-target-name-override': 'peer0.org1.example.com'
      });
      channel.addPeer(peer);

      var member_user = null;
      var store_path = path.join(os.homedir(), '.hfc-key-store');
      console.log('Store path:'+store_path);
      var tx_id = null;

      Fabric_Client.newDefaultKeyValueStore({ path: store_path
      }).then((state_store) => {
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();

        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        return fabric_client.getUserContext('user1', true);

      }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
          console.log('Successfully loaded user1 from persistence');
          member_user = user_from_store;
        } else {
          throw new Error('FAiled to get user, register user first');
        }

        const request = {
          chaincodeId: 'peoplechain',
          txId: tx_id,
          fcn: 'queryRecord',
          args: [key]
        };

        return channel.queryByChaincode(request);
      }).then((query_responses) => {
        console.log("Query has completed cheching results");

        if (query_responses && query_responses.length == 1) {
          if (query_responses[0] instanceof Error) {
            console.error("error from query = ", query_responses[0]);
            res.send("Could not locate record")
          } else {
            console.log("Response is ", query_responses[0].toString());
            res.send(query_responses[0].toString());
          }
        } else {
          console.log("No payloads were returned from the query");
          res.send("Could not locate record");
        }
      }).catch((err) => {
        console.error('Failed to query successfully :: ' + err);
        res.send("Could not locate record");
      });
    }, // Next function here
    grant_access: function(req, res) {

      var array = req.params.details.split("-");
      console.log("Granting access to the organization: " + array[1]);
      const basePath = path.resolve(__dirname, './certs');
      const readCryptoFile = filename => fs.readFileSync(path.resolve(basePath, filename)).toString();
      var private_string = "";
      //
      var fabric_client = new Fabric_Client();

      // setup the fabric network
      var channel = fabric_client.newChannel('mychannel');
      var peer = fabric_client.newPeer('grpcs://localhost:7051', {
        pem: readCryptoFile('peer1.pem'),
        'ssl-target-name-override': 'peer0.org1.example.com'
      });
      channel.addPeer(peer);
      var order = fabric_client.newOrderer('grpcs://localhost:7050', {
        pem: readCryptoFile('Orderer.pem'),
        'ssl-target-name-override': 'orderer.example.com'
      });
      channel.addOrderer(order);

      //
      var member_user = null;
      var store_path = path.join(os.homedir(), '.hfc-key-store');
      console.log('Store path:'+store_path);
      var tx_id = null;

      Fabric_Client.newDefaultKeyValueStore({ path: store_path
      }).then((state_store) => {
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // get the enrolled user from persistence, this user will sign all requests
        return fabric_client.getUserContext('user1', true);
      }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
          console.log('Successfully loaded user1 from persistence.');
          member_user = user_from_store;
        } else {
          throw new Error('Failed to get user1, register User');
        }

        tx_id = fabric_client.newTransactionID();
        console.log("Assigning transaction id: ", tx_id._transaction_id);

        var id = array[0];
        var org_pub = array[1];
        var user_priv = array[2];

        var file_name = './user/' + array[0] + '.txt';
        
        var record_string = fs.readFileSync(file_name, 'utf-8');
        var record = JSON.parse(record_string);
        var private_data = record.data.private;

        var private_string = private_data.toString();

        console.log("Private string" + private_string);

        var request = {
          chaincodeId: 'peoplechain',
          fcn: 'grantAccess',
          args: [id, org_pub, private_string, user_priv],
          txId: tx_id,
        };

        return channel.sendTransactionProposal(request);
      }).then((results) => {
        var proposalResponses = results[0];
        var proposal = results[1];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response &&
          proposalResponses[0].response.status === 200) {
            isProposalGood = true;
            console.log('Transaction proposal was good');
          } else {
            console.error('Transaction proposal was bad');
          }
        if (isProposalGood) {
          console.log(util.format(
            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
            proposalResponses[0].response.status, proposalResponses[0].response.message));

          // build up the request for the orderer to have the transaction committed
          var request = {
            proposalResponses: proposalResponses,
            proposal: proposal
          };

          // set the transaction listener and set a timeout of 30 sec
          // if the transaction did not get committed within the timeout period,
          // report a TIMEOUT status
          var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
          var promises = [];

          var sendPromise = channel.sendTransaction(request);
          promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

          // get an eventhub once the fabric client has a user assigned. The user
          // is required bacause the event registration must be signed
          let event_hub = fabric_client.newEventHub();
          event_hub.setPeerAddr('grpcs://localhost:7053', {
            pem: readCryptoFile('peer1.pem'),
            'ssl-target-name-override': 'peer0.org1.example.com'
          });

          // using resolve the promise so that result status may be processed
          // under the then clause rather than having the catch clause process
          // the status
          let txPromise = new Promise((resolve, reject) => {
            let handle = setTimeout(() => {
              event_hub.disconnect();
              resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
            }, 3000);
            event_hub.connect();
            event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
              // this is the callback for transaction event status
              // first some clean up of event listener
              clearTimeout(handle);
              event_hub.unregisterTxEvent(transaction_id_string);
              event_hub.disconnect();

              // now let the application know what happened
              var return_status = {event_status : code, tx_id : transaction_id_string};
              if (code !== 'VALID') {
                console.error('The transaction was invalid, code = ' + code);
                resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
              } else {
                console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                resolve(return_status);
              }
            }, (err) => {
              //this is the callback if something goes wrong with the event registration or processing
              reject(new Error('There was a problem with the eventhub ::'+err));
            });
          });
          promises.push(txPromise);

          return Promise.all(promises);
        } else {
          console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
          throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
      }).then((results) => {
        console.log('Send transaction promise and event listener promise have completed');
        console.log(results);
        if (results && results[0] && results[0].status === 'SUCCESS') {
          console.log('Successfully sent transaction to the orderer.');
          res.send(tx_id.getTransactionID());
        } else {
          console.error('Failed to order the transaction. Error code: ' + response.status);
        }
      
        if(results && results[1] && results[1].event_status === 'VALID') {
          console.log('Successfully committed the change to the ledger by the peer');
          res.send(tx_id.getTransactionID());
        } else {
          console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
        }

      }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
      });
      
    }, // Next function here 
    decline_access: function(req, res){

      console.log("Creating record");

      var array = req.params.details.split("-");
      const basePath = path.resolve(__dirname, './certs');
      const readCryptoFile = filename => fs.readFileSync(path.resolve(basePath, filename)).toString();

      //
      var fabric_client = new Fabric_Client();

      // setup the fabric network
      var channel = fabric_client.newChannel('mychannel');
      var peer = fabric_client.newPeer('grpcs://localhost:7051', {
        pem: readCryptoFile('peer1.pem'),
        'ssl-target-name-override': 'peer0.org1.example.com'
      });
      channel.addPeer(peer);
      var order = fabric_client.newOrderer('grpcs://localhost:7050', {
        pem: readCryptoFile('Orderer.pem'),
        'ssl-target-name-override': 'orderer.example.com'
      });
      channel.addOrderer(order);

      //
      var member_user = null;
      var store_path = path.join(os.homedir(), '.hfc-key-store');
      console.log('Store path:'+store_path);
      var tx_id = null;

      Fabric_Client.newDefaultKeyValueStore({ path: store_path
      }).then((state_store) => {
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // get the enrolled user from persistence, this user will sign all requests
        return fabric_client.getUserContext('user1', true);
      }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
          console.log('Successfully loaded user1 from persistence.');
          member_user = user_from_store;
        } else {
          throw new Error('Failed to get user1, register User');
        }

        tx_id = fabric_client.newTransactionID();
        console.log("Assigning transaction id: ", tx_id._transaction_id);

        var id = array[0];
        var pubkey = array[1];

        var request = {
          chaincodeId: 'peoplechain',
          fcn: 'revokeAccess',
          args: [id, pubkey],
          txId: tx_id,
        };

        return channel.sendTransactionProposal(request);
      }).then((results) => {
        var proposalResponses = results[0];
        var proposal = results[1];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response &&
          proposalResponses[0].response.status === 200) {
            isProposalGood = true;
            console.log('Transaction proposal was good');
          } else {
            console.error('Transaction proposal was bad');
          }
        if (isProposalGood) {
          console.log(util.format(
            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
            proposalResponses[0].response.status, proposalResponses[0].response.message));

          // build up the request for the orderer to have the transaction committed
          var request = {
            proposalResponses: proposalResponses,
            proposal: proposal
          };

          // set the transaction listener and set a timeout of 30 sec
          // if the transaction did not get committed within the timeout period,
          // report a TIMEOUT status
          var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
          var promises = [];

          var sendPromise = channel.sendTransaction(request);
          promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

          // get an eventhub once the fabric client has a user assigned. The user
          // is required bacause the event registration must be signed
          let event_hub = fabric_client.newEventHub();
          event_hub.setPeerAddr('grpcs://localhost:7053', {
            pem: readCryptoFile('peer1.pem'),
            'ssl-target-name-override': 'peer0.org1.example.com'
          });

          // using resolve the promise so that result status may be processed
          // under the then clause rather than having the catch clause process
          // the status
          let txPromise = new Promise((resolve, reject) => {
            let handle = setTimeout(() => {
              event_hub.disconnect();
              resolve({event_status : 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
            }, 3000);
            event_hub.connect();
            event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
              // this is the callback for transaction event status
              // first some clean up of event listener
              clearTimeout(handle);
              event_hub.unregisterTxEvent(transaction_id_string);
              event_hub.disconnect();

              // now let the application know what happened
              var return_status = {event_status : code, tx_id : transaction_id_string};
              if (code !== 'VALID') {
                console.error('The transaction was invalid, code = ' + code);
                resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
              } else {
                console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                resolve(return_status);
              }
            }, (err) => {
              //this is the callback if something goes wrong with the event registration or processing
              reject(new Error('There was a problem with the eventhub ::'+err));
            });
          });
          promises.push(txPromise);

          return Promise.all(promises);
        } else {
          console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
          throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
      }).then((results) => {
        console.log('Send transaction promise and event listener promise have completed');
        console.log(results);
        if (results && results[0] && results[0].status === 'SUCCESS') {
          console.log('Successfully sent transaction to the orderer.');
          res.send(tx_id.getTransactionID());
        } else {
          console.error('Failed to order the transaction. Error code: ' + response.status);
        }
      
        if(results && results[1] && results[1].event_status === 'VALID') {
          console.log('Successfully committed the change to the ledger by the peer');
          res.send(tx_id.getTransactionID());
        } else {
          console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
        }

      }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
      });

    }, // Next function here
  }
})();
