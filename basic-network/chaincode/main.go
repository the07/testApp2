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
	Data string `json:"data"`						// Public data
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
}

type organization struct {
	PublicKey string `json:"public_key"`
	OrgName string `json:"organization_name"`
}

type Payment struct {
	From string `json:"from"`
	To string `json:"to"`
	Amount int `json:"amount"`
}

type RecordAccess struct {
	Id string `json:"id"`
	PublicKey string `json:"public_key"` //one who has signed the record
	OrgPublicKey string `json:"org_public_key"` //one who is requesting access
	Data string `json:"data"`
	Status string `json:"status"`
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
	} else if function == "decryptRecord" {
		return s.decryptRecord(APIstub, args)
	} else if function == "declineRecord" {
		return s.declineRecord(APIstub, args)
	} else if function == "requestAccess" {
		return s.requestAccess(APIstub, args)
	} else if function == "grantAccess" {
		return s.grantAccess(APIstub, args)
	} else if function == "revokeAccess" {
		return s.revokeAccess(APIstub, args)
	} else if function == "getUserData" {
		return s.getUserData(APIstub, args)
	} else if function == "getOrgsData" {
		return s.getOrgsData(APIstub, args)
	} else if function == "decryptRecordAccess" {
		return s.decryptRecordAccess(APIstub, args)
	} else if function == "getBalance" {
		return s.getBalance(APIstub, args)
	} else if function == "getRecordAccess" {
		return s.getRecordAccess(APIstub, args)
	}

	return shim.Error("Invalid function name")
}

func (s *PeoplechainChaincode) createRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 6 {
		return shim.Error("Incorrect number of arguments, expecting 5")
	}

	// arguments - key, userPublicKey, userPrivateKey, orgPublicKey, private_Date, public_Data

	var nonce [24]byte
	if _, err := io.ReadFull(rand.Reader, nonce[:]);  err != nil {
		panic(err)
	}

	userPrivateKeyByte, _ := hex.DecodeString(args[2])
	orgPublicKeyByte, _ := hex.DecodeString(args[3])

	var key1, key2 [32]byte
	copy(key1[:], userPrivateKeyByte)
	copy(key2[:], orgPublicKeyByte)

	msg := []byte(args[4])
	encrypted := box.Seal(nonce[:], msg, &nonce, &key2, &key1)
	hash := hex.EncodeToString(encrypted[:])

	var record = Record { User: args[1], Organization: args[3], Status: "PENDING",	Hash: hash, Data: args[5]  }

	recordAsBytes, _ := json.Marshal(record)

	err1 := APIstub.PutState(args[0], recordAsBytes)
	if err1 != nil {
		return shim.Error(fmt.Sprintf("Failed to create record: %s", args[0]))
	}
	attributes := []string{"user1"}
	key, _ := APIstub.CreateCompositeKey("user", attributes)
	userAsByte, _ := APIstub.GetState(key)

	if userAsByte == nil {
		return shim.Error("Could not locate user")
	}

	user_1 := user{}
	json.Unmarshal(userAsByte, &user_1)

	user_1.RecordIndex = append(user_1.RecordIndex, args[0])

	userAsBytes, _ := json.Marshal(user_1)
	err4 := APIstub.PutState(key, userAsBytes)

	if err4 != nil {
		return shim.Error("Failed to update User Record Index")
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

	username := args[0]
	attributes := []string{username}
	index_list := []string{}
	key, _ := APIstub.CreateCompositeKey("user", attributes)
	var user_object = user{PublicKey: userPublicKeyHex, Username: args[0], FirstName: args[1], LastName: args[2], RecordIndex: index_list}
	userPrivateKeyHex := hex.EncodeToString(userPrivateKey[:])

	userAsByte, _ := json.Marshal(user_object)
	err2 := APIstub.PutState(key, userAsByte)
	if err2 != nil {
		return shim.Error(fmt.Sprintf("Failed to create user: %s", key))
	}

	key_pair := map[string]string{
		"pubkey": userPublicKeyHex,
		"privkey": userPrivateKeyHex,
	}

	keyByte, _ := json.Marshal(key_pair)

	return shim.Success(keyByte)
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
	attributes := []string{args[0]}
	key, _ := APIstub.CreateCompositeKey("organization", attributes)
	var org_object = organization{PublicKey: organizationPublicKeyHex, OrgName: args[0]}

	orgAsByte, _ := json.Marshal(org_object)
	err3 := APIstub.PutState(key, orgAsByte)
	if err3 != nil {
		return shim.Error(fmt.Sprintf("Failed to create organization: %s", key))
	}

	key_pair := map[string]string{
		"pubkey": organizationPublicKeyHex,
		"privkey": organizationPrivateKeyHex,
	}

	keyByte, _ := json.Marshal(key_pair)

	return shim.Success(keyByte)
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

	recordAsByte, _ := APIstub.GetState(args[0])
	if recordAsByte == nil {
		return shim.Error("Record not found")
	}

	record := Record{}
	json.Unmarshal(recordAsByte, &record)

	record.Status = "SIGNED"
	recordAsBytes, _ := json.Marshal(record)

	err := APIstub.PutState(args[0], recordAsBytes)

	if err != nil {
		return shim.Error("Unable to sign record")
	}

	payment := Payment{ From: record.User, To: record.Organization, Amount: 50}
	paymentAsByte, _ := json.Marshal(payment)

	paymentAttr := []string{payment.To, payment.From}
	payKey, _ := APIstub.CreateCompositeKey("payment", paymentAttr)

	err1 := APIstub.PutState(payKey, paymentAsByte)

	if err1 != nil {
		return shim.Error("Unable to create payment record")
	}

	return shim.Success(nil)
}

func (s *PeoplechainChaincode) declineRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
			return shim.Error("Incorrect number of arguments, expecting 1")
	}

	recordAsByte, _ := APIstub.GetState(args[0])
	if recordAsByte == nil {
		return shim.Error("Record not found")
	}

	record := Record{}
	json.Unmarshal(recordAsByte, &record)

	record.Status = "DECLINED"
	recordAsBytes, _ := json.Marshal(record)

	err := APIstub.PutState(args[0], recordAsBytes)

	if err != nil {
		return shim.Error("Unable to sign record")
	}

	return shim.Success(nil)
}

func (s *PeoplechainChaincode) decryptRecord(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments, expecting 2")
	}

	recordAsByte, _ := APIstub.GetState(args[0])
	if recordAsByte == nil {
		return shim.Error("Record not found")
	}
	record := Record{}
	json.Unmarshal(recordAsByte, &record)

	hash := record.Hash
	var decryptNonce [24]byte

	hashByte, _ := hex.DecodeString(hash)
	copy(decryptNonce[:], hashByte[:24])

	var key1, key2 [32]byte
	key1Byte, _ := hex.DecodeString(record.User)
	key2Byte, _ := hex.DecodeString(args[1])

	copy(key1[:], key1Byte)
	copy(key2[:], key2Byte)

	decrypted, ok := box.Open(nil, hashByte[24:], &decryptNonce, &key1, &key2)
	if !ok {
		return shim.Error("Failed to decrypt")
	}
	data := []byte(decrypted)
	return shim.Success(data)
}

func (s *PeoplechainChaincode) requestAccess(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments")
	}

	recordAsByte, _ := APIstub.GetState(args[0])
	if recordAsByte == nil {
		return shim.Error("Record Not Found")
	}

	record := Record{}
	json.Unmarshal(recordAsByte, &record)

	recordAccess := RecordAccess{ Id: args[0], PublicKey: record.Organization, OrgPublicKey: args[1], Data: "NULL", Status: "PENDING"}
	recordAccessAsByte, _ := json.Marshal(recordAccess)
	attributes := []string{args[0], args[1]}
	key, _ := APIstub.CreateCompositeKey("ra", attributes)
	err := APIstub.PutState(key, recordAccessAsByte)

	if err != nil {
		return shim.Error("Unable to request access")
	}

	return shim.Success(nil)
}

func (s *PeoplechainChaincode) grantAccess(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments")
	}

	var nonce [24]byte
	if _, err := io.ReadFull(rand.Reader, nonce[:]);  err != nil {
		panic(err)
	}

	attributes := []string{args[0], args[1]}
	key, _ := APIstub.CreateCompositeKey("ra", attributes)
	recordAccessAsByte, errAccess := APIstub.GetState(key)

	if errAccess != nil {
		return shim.Error("RecordAccess file not found.")
	}

	recordAccess := RecordAccess{}
	json.Unmarshal(recordAccessAsByte, &recordAccess)

	recordAccess.Status = "GRANTED"

	recordAsByte, _ := APIstub.GetState(args[0])
	record := Record{}
	json.Unmarshal(recordAsByte, &record)

	hash := record.Hash
	var decryptNonce [24]byte

	hashByte, _ := hex.DecodeString(hash)
	copy(decryptNonce[:], hashByte[:24])

	var key1, key2, key3 [32]byte
	key1Byte, _ := hex.DecodeString(record.User)
	key2Byte, _ := hex.DecodeString(args[2])
	key3Byte, _ := hex.DecodeString(args[1])

	copy(key1[:], key1Byte)
	copy(key2[:], key2Byte)
	copy(key3[:], key3Byte)

	decrypted, ok := box.Open(nil, hashByte[24:], &decryptNonce, &key1, &key2)
	if !ok {
		return shim.Error("Failed to decrypt")
	}

	encrypted := box.Seal(nonce[:], []byte(decrypted), &nonce, &key3, &key2)
	msg := hex.EncodeToString(encrypted[:])

	recordAccess.Data = msg
	recordAccessAsBytes, _ := json.Marshal(recordAccess)

	err2 := APIstub.PutState(key, recordAccessAsBytes)

	if err2 != nil {
		return shim.Error("Failed to grant access")
	}

	payment := Payment{ From: args[1], To: record.User, Amount: 50}
	paymentAsByte, _ := json.Marshal(payment)

	paymentAttr := []string{payment.To, payment.From}
	payKey, _ := APIstub.CreateCompositeKey("payment", paymentAttr)

	err1 := APIstub.PutState(payKey, paymentAsByte)
	if err1 != nil {
		return shim.Error("Unable to create payment record")
	}
	return shim.Success(recordAccessAsBytes)
}

func (s *PeoplechainChaincode) revokeAccess(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments")
	}

	attributes := []string{args[0], args[1]}
	key, _ := APIstub.CreateCompositeKey("ra", attributes)
	recordAccessAsByte, _ := APIstub.GetState(key)

	recordAccess := RecordAccess{}
	json.Unmarshal(recordAccessAsByte, &recordAccess)

	recordAccess.Status = "DECLINED"
	recordAccess.Data = "NULL"

	recordAccessAsBytes, _ := json.Marshal(recordAccess)

	err := APIstub.PutState(key, recordAccessAsBytes)

	if err != nil {
		return shim.Error("Failed to grant access")
	}

	return shim.Success(nil)
}

func (s *PeoplechainChaincode) decryptRecordAccess(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments")
	}

	attributes := []string{args[0], args[1]}
	key, _ := APIstub.CreateCompositeKey("ra", attributes)
	recordAccessAsByte, errAccess := APIstub.GetState(key)

	if errAccess != nil {
		return shim.Error("Failed to locate RecordAccess")
	}

	recordAccess := RecordAccess{}
	json.Unmarshal(recordAccessAsByte, &recordAccess)

	hash := recordAccess.Data
	var decryptNonce [24]byte

	hashByte, decodeError := hex.DecodeString(hash)
	if decodeError != nil {
		return shim.Error("Failed to decode hash or hash does not exists.")
	}
	copy(decryptNonce[:], hashByte[:24])

	var key1, key2 [32]byte
	key1Byte, _ := hex.DecodeString(recordAccess.PublicKey)
	key2Byte, _ := hex.DecodeString(args[2])

	copy(key1[:], key1Byte)
	copy(key2[:], key2Byte)

	decrypted, ok := box.Open(nil, hashByte[24:], &decryptNonce, &key1, &key2)
	if !ok {
		return shim.Error("Failed to decrypt")
	}

	return shim.Success(decrypted)

}

func (s *PeoplechainChaincode) getUserData(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	return shim.Success(nil)
}

func (s *PeoplechainChaincode) getOrgsData(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	return shim.Success(nil)
}

func (s *PeoplechainChaincode) getBalance(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments")
	}

	balance := 1000

	resultsIterator, err := APIstub.GetStateByPartialCompositeKey("payment",[]string{})
	if err != nil {
		return shim.Error(err.Error())
	}

	defer resultsIterator.Close()

	counter := 0
	for ;;resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}

		payment := Payment{}
		json.Unmarshal(queryResponse.Value, payment)

		if payment.To == args[0] {
			balance += payment.Amount
		} else if payment.From == args[0] {
			balance -= payment.Amount
		}

		counter += 1
	}

	response := map[string]int{
		"Balance": balance,
		"Counter": counter,
	}

	responseByte, _ := json.Marshal(response)

	return shim.Success(responseByte)
}

func (s *PeoplechainChaincode) getRecordAccess(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments")
	}

	attributes := []string{args[0], args[1]}
	key, _ := APIstub.CreateCompositeKey("ra", attributes)

	recordAccessAsByte, _ := APIstub.GetState(key)

	if recordAccessAsByte == nil {
		return shim.Error("No Record Access File found")
	}

	return shim.Success(recordAccessAsByte)
}


func main() {
	err := shim.Start(new(PeoplechainChaincode))
	if err != nil {
		fmt.Printf("Error starting Peoplechain chaincode: %s", err)
	}
}
