package main

import (
	"fmt"
	"bytes"
	"time"
	"encoding/json"
	"encoding/hex"
	"crypto/rand"
	"io"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
	"golang.org/x/crypto/nacl/box"
)

type Record struct {
	User string `json:"user"`						// Record Owner Public Key
	Organization string `json:"organization"`		// Signing entity Public Key
	Status string `json:"status`					// Status of the record - if signed
	Hash string `json:"hash"`						// Hash of the content of the record
	Sign string `json:"string"`						// Verifiable signature of the Signing entity
	//CreationTime time.Time `json:"creation_time"` // Time when record was created
}

// Each record should be unique - Match hash if record already exists

type GovernmentRecord struct {
	Aadhar string `json:"aadhar"`
	Pan string `json:"pan"`
}

type EducationRecord struct {
	StartDate time.Time `json:"start_date"`
	EndDate time.Time `json:"end_date"`
	Grade int `json:"grade"`
}

type CompanyRecord struct {
	StartDate time.Time `json:"start_date"`
	EndDate time.Time `json:"end_date`
	Role string `json:"role"`
	Details string `json:"details"`
	Salary int `json:"details"`
}

type user struct {
	PublicKey string `json:"public_key"`
	Username string `json:"username"`
	FirstName string `json:"first_name"`
	LastName string `json:"last_name"`
	RecordIndex []string `json:"record"`
	Balance int `json:"balance"`
}

type organization struct {
	PublicKey string `json:"public_key"`
	OrgName string `json:"organization_name"`
	Balance int `json:"balance"`
}

type PeoplechainChaincode struct {
}

func (s *PeoplechainChaincode) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

func (s *PeoplechainChaincode) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {
	function, args := APIstub.GetFunctionAndParameters()
	if function == "createRecord" {
		return s.createRecord(APIstub, args)
	} else if function == "queryRecord" {
		return s.queryRecord(APIstub, args)
	} else if function == "queryAllRecord" {
		return s.queryAllRecord(APIstub)
	} else if function == "createUser" {
		return s.createUser(APIstub, args)
	} else if function == "createOrganization" {
		return s.createOrganization(APIstub, args)
	} else if function == "verifyRecord" {
		return s.verifyRecord(APIstub, args)
	} else if function == "signRecord" {
		return s.signRecord(APIstub, args)
	}

	return shim.Error("Invalid function name")
}

func (s *PeoplechainChaincode) createRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments, expecting 5")
	}

	// arguments - key, userPublicKey, userPrivateKey, orgPublicKey, datajson

	var nonce [24]byte
	if _, err := io.ReadFull(rand.Reader, nonce[:]);  err != nil {
		panic(err)
	}

	dataByte, err := json.Marshal(args[4])
	if err != nil {
		panic(err)
	}

	userPrivateKeyByte, _ := hex.DecodeString(args[2])
	orgPublicKeyByte, _ := hex.DecodeString(args[3])

	var key1, key2 [32]byte
	copy(key1[:], userPrivateKeyByte)
	copy(key2[:], orgPublicKeyByte)

	msg := []byte(dataByte)
	encrypted := box.Seal(nonce[:], msg, &nonce, &key2, &key1)
	hash := hex.EncodeToString(encrypted[:])

	var record = Record { User: args[1], Organization: args[3], Status: "PENDING",	Hash: hash, Sign: "NULL"  }

	recordAsBytes, _ := json.Marshal(record)

	err1 := APIstub.PutState(args[0], recordAsBytes)
	if err1 != nil {
		return shim.Error(fmt.Sprintf("Failed to create record: %s", args[0]))
	}

	return shim.Success(nil)
}

func (s *PeoplechainChaincode) queryRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1{
		return shim.Error("Incorrect number of arguments, expecting 1")
	}

	recordAsBytes, _ := APIstub.GetState(args[0])
	if recordAsBytes == nil {
		return shim.Error("Could not find record")
	}

	return shim.Success(recordAsBytes)
}

func (s *PeoplechainChaincode) queryAllRecord(APIstub shim.ChaincodeStubInterface) sc.Response {

	startKey := "0"
	endKey := "999"

	resultsIterator, err := APIstub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}

		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}

		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- queryAllRecord:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

func (s *PeoplechainChaincode) createUser(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments, expecting 3")
	}

	reader := rand.Reader
	userPublicKey, userPrivateKey, err := box.GenerateKey(reader)
	if err != nil {
		panic(err)
	}

	userPublicKeyHex := hex.EncodeToString(userPublicKey[:])
	userPrivateKeyHex := hex.EncodeToString(userPrivateKey[:])
	attributes := [1]string{args[0]}
	key := APIstub.CreateCompositeKey("user", attributes)
	var user_object = user{PublicKey: userPublicKeyHex, Username: args[0], FirstName: args[1], LastName: args[2], RecordIndex: attributes, Balance: 0}

	userAsByte, _ := json.Marshal(user_object)
	err2 := APIstub.PutState(key, userAsByte)
	if err2 != nil {
		return shim.Error(fmt.Sprintf("Failed to create user: %s", key))
	}

	return shim.Success(userPrivateKeyHex)
}

func (s *PeoplechainChaincode) createOrganization(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments, expecting 1")
	}

	reader := rand.Reader
	organizationPublicKey, organizationPrivateKey, err := box.GenerateKey(reader)
	if err != nil {
		panic(err)
	}

	organizationPublicKeyHex := hex.EncodeToString(organizationPublicKey[:])
	organizationPrivateKeyHex := hex.EncodeToString(organizationPrivateKey[:])

	key := APIstub.CreateCompositeKey("organization", args[0])
	var org_object = organization{PublicKey: organizationPublicKeyHex, OrgName: args[0], Balance: 0}

	orgAsByte, _ := json.Marshal(org_object)
	err3 := APIstub.PutState(key, orgAsByte)
	if err3 != nil {
		return shim.Error(fmt.Sprintf("Failed to create organization: %s", key))
	}

	return shim.Success(organizationPrivateKeyHex)
}

func (s *PeoplechainChaincode) verifyRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments, expecting 1")
	}

	return shim.Success(nil)
}

func (s *PeoplechainChaincode) signRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect numberof arguments, expecting 1")
	}

	return shim.Success(nil)
}

func main() {
	err := shim.Start(new(PeoplechainChaincode))
	if err != nil {
		fmt.Printf("Error starting Peoplechain chaincode: %s", err)
	}
}
