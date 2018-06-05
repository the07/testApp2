package main

import (
	"fmt"
  "bytes"
  "encoding/json"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
)

// PeoplechainChaincode example simple Chaincode implementation
type PeoplechainChaincode struct {
}

type Record struct {
	User string `json:"user"`
  Timestamp string `json:"timestamp"`
  Organization string `json:"organization"`
  Status string `json:"status"`
}

func (s *PeoplechainChaincode) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

func (s *PeoplechainChaincode) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {

  function, args := APIstub.GetFunctionAndParameters()
  if function == "queryRecord" {
    return s.queryRecord(APIstub, args)
  } else if function == "createRecord" {
    return s.createRecord(APIstub, args)
  } else if function == "queryAllRecord" {
    return s.queryAllRecord(APIstub)
  }

  return shim.Error("Invalid function name")
}

func (s *PeoplechainChaincode) queryRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
  if len(args) != 1 {
    return shim.Error("Incorrect number of arguments. Expecting 1")
  }

  recordAsBytes, _ := APIstub.GetState(args[0])
  if recordAsBytes == nil {
    return shim.Error("Could not find record")
  }
  return shim.Success(recordAsBytes)
}

func (s *PeoplechainChaincode) createRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
  if len(args) != 5 {
    return shim.Error("Incorrect number of arguments, expecting 5")
  }

  var record = Record{ User: args[1], Timestamp: args[2], Organization: args[3], Status: args[4] }

  recordAsBytes, _ := json.Marshal(record)
  err := APIstub.PutState(args[0], recordAsBytes)
  if err != nil {
    return shim.Error(fmt.Sprintf("Failed to create record: %s", args[0]))
  }

  return shim.Success(nil)
}

func (s *PeoplechainChaincode) queryAllRecord(APIstub shim.ChaincodeStubInterface) sc.Response {

	startKey := "0"
	endKey := "999"

	resultsIterator, err := APIstub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add comma before array members,suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- queryAllRecord:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

func main() {
	err := shim.Start(new(PeoplechainChaincode))
	if err != nil {
		fmt.Printf("Error starting Peoplechain chaincode: %s", err)
	}
}
