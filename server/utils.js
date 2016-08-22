var totalRecentTransactions = 15;
var totalRecentCustomers = 10;
var Web3 = require('web3');
var web3 = new Web3();
var provider = "http://192.168.101.201";
var SkipTraceContractAddress = "0x5af0669b0d83b52664847f41539b0b7954bea365";
var SkipTraceContractSequence = "contract Sequence { uint sequenceNo; function Sequence() { sequenceNo = 0; } function nextVal() returns (uint number) { return ++sequenceNo; } } contract CustomerDetails { struct CustomerData { uint customerID; address bankID; string profile; string phone; string addresses; string employer; string products; string remarks; uint timestamp; } mapping (uint => CustomerData) public custDataOf; } contract CustomerSkipTrace is Sequence, CustomerDetails { event SkipTraceAddEvent(uint customerID, address bankID, string profile, string phone, string addresses, string employer, string products, string remarks, uint timestamp); event SkipTraceQueryEvent(uint customerID, address bankID, string profile, string phone, string addresses, string employer, string products, string remarks, uint timestamp); event SkipTraceUpdateEvent(uint customerID, address bankID, string profile, string phone, string addresses, string employer, string products, string remarks, uint timestamp); event SkipTraceRecordCountEvent(uint recordCount); function addSkipTraceRecord(string profile, string phone, string addresses, string employer, string products, string remarks) { uint customerID = nextVal(); address bankID = msg.sender; uint timestamp = now; custDataOf[customerID].customerID = customerID; custDataOf[customerID].bankID = bankID; custDataOf[customerID].profile = profile; custDataOf[customerID].phone = phone; custDataOf[customerID].addresses = addresses; custDataOf[customerID].employer = employer; custDataOf[customerID].products = products; custDataOf[customerID].remarks = remarks; custDataOf[customerID].timestamp = timestamp; SkipTraceAddEvent(customerID, bankID, profile, phone, addresses, employer, products, remarks, timestamp); } function querySkipTraceRecord(uint customerID) { if (customerID>0 && customerID<=sequenceNo) SkipTraceQueryEvent(custDataOf[customerID].customerID, custDataOf[customerID].bankID, custDataOf[customerID].profile, custDataOf[customerID].phone, custDataOf[customerID].addresses, custDataOf[customerID].employer, custDataOf[customerID].products, custDataOf[customerID].remarks, custDataOf[customerID].timestamp); } function updateSkipTraceRecord(uint customerID, string profile, string phone, string addresses, string employer, string products, string remarks) { if (customerID>0 && customerID<=sequenceNo) { address bankID = msg.sender; uint timestamp = now; custDataOf[customerID].customerID = customerID; custDataOf[customerID].bankID = bankID; custDataOf[customerID].profile = profile; custDataOf[customerID].phone = phone; custDataOf[customerID].addresses = addresses; custDataOf[customerID].employer = employer; custDataOf[customerID].products = products; custDataOf[customerID].remarks = remarks; custDataOf[customerID].timestamp = timestamp; SkipTraceUpdateEvent(customerID, bankID, profile, phone, addresses, employer, products, remarks, timestamp); } } function reset() { for (uint i = 1; i<=sequenceNo; i++){ delete custDataOf[i]; } sequenceNo = 0; } function getRecordCount() { SkipTraceRecordCountEvent(sequenceNo); } }";
var SkipTraceCompiled;
var SkipTraceContract;

module.exports = {
    init: function(port, coinBaseAddress) {
        web3.setProvider(new web3.providers.HttpProvider(provider+':'+port));
        web3.eth.defaultAccount = web3.eth.accounts[0];
        SkipTraceCompiled = web3.eth.compile.solidity(SkipTraceContractSequence);
        SkipTraceContract = web3.eth.contract(SkipTraceCompiled.CustomerSkipTrace.info.abiDefinition);
    },
    getRecentBlocks: function(port, coinBaseAddress) {
        this.init(port, coinBaseAddress);
        var txs = web3.eth.blockNumber;
        var transactions = [];
        for  (var i = txs; i > txs-totalRecentTransactions; i--) {
            var block = web3.eth.getBlock(i);
            transactions.push({
                id: i,
                hash: block.hash,
                difficulty: block.difficulty.c[0],
                miner: block.miner,
                gasUsed: block.gasUsed,
                timestamp: block.timestamp,
                transactions: block.transactions.length
            });
        }
        return transactions;
    },
    getBlockDetails: function(id, port, coinBaseAddress) {
        this.init(port, coinBaseAddress);
        var block = web3.eth.getBlock(id);
        var transactions = block.transactions;
        var consolidatedTransactions = [];
        transactions.forEach(function(txn) {
            var txnDetails = web3.eth.getTransaction(txn);
            consolidatedTransactions.push({
                hash: txnDetails.hash,
                from: txnDetails.from,
                to: txnDetails.to,
                value: web3.fromWei(txnDetails.value, "ether").c[0]
            });
        });
        return {
            number: block.number,
            hash: block.hash,
            nonce: block.nonce,
            stateRoot: block.stateRoot,
            miner: block.miner,
            difficulty: block.difficulty,
            size: block.size,
            extraData: block.extraData,
            gasLimit: block.gasLimit,
            gasUsed: block.gasUsed,
            timestamp: block.timestamp,
            transactions: consolidatedTransactions
        }
    },
    getRecentCustomers: function(port, coinBaseAddress) {
        this.init(port, coinBaseAddress);
        var customers = [];
        var total = this.getRecordCountFromDB();
        for (var i = total; i > total-totalRecentCustomers; i--) {
            var customer = this.getCustomerDetailsFromDB(i);
            if(customer) {
                customers.push({
                    customerID: customer.customerID,
                    bankID : customer.bankID,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    timestamp: customer.timestamp
                });
            }
        }
        return customers;
    },
    getRecordCountFromDB: function () {
        var obj = JSON.parse(web3.db.getString("CreateLog", "logString"));
        return obj.length;
    },
    getCustomerDetailsFromDB: function (customerID, port, coinBaseAddress) {
        if(port && coinBaseAddress) {
            this.init(port, coinBaseAddress);
        }
        var position = null;
        obj = JSON.parse(web3.db.getString("UpdateLog", "logString"));
        for (var i = 0; i < obj.length; i++) {
            if (obj[i].customerID == customerID) {
                obj[i].bankID = this.getBankName(obj[i].bankID);
                return obj[i];
            }
        }
        obj = JSON.parse(web3.db.getString("CreateLog", "logString"));
        for (var i = 0; i < obj.length; i++) {
            if (obj[i].customerID == customerID) {
                obj[i].bankID = this.getBankName(obj[i].bankID);
                return obj[i];
            }
        }
        return null;
    },
    getBankName: function (address) {
        if(address) {
            var bank = web3.db.getString("AddressNameMap", address);
            var bankName = JSON.parse(bank);
            return bankName.name;
        }
        return '';
    },

    addSkipTraceRecordOnChain: function (port, coinBaseAddress, firstName, middleName, lastName, aliasName, DOB, SSN, passportNumber, homePhone1, homePhone2, homePhone3, workPhone1, workPhone2, workPhone3, mobilePhone1, mobilePhone2, mobilePhone3, currentAddress1, currentAddress2, currentAddress3, employerName1, employerName2, employerName3, productName1, productName2, productName3, remarks) {
        var profile = "firstName:" + this.cleanUp(firstName) + "|" + "middleName:" + this.cleanUp(middleName) + "|" + "lastName:" + this.cleanUp(lastName) + "|" + "aliasName:" + this.cleanUp(aliasName) + "|" + "DOB:" + this.cleanUp(DOB) + "|" + "SSN:" + this.cleanUp(SSN) + "|" + "passportNumber:" + this.cleanUp(passportNumber);
        var phone = "homePhone1:" + this.cleanUp(homePhone1) + "|" + "homePhone2:" + this.cleanUp(homePhone2) + "|" + "homePhone3:" + this.cleanUp(homePhone3) + "|" + "workPhone1:" + this.cleanUp(workPhone1) + "|" + "workPhone2:" + this.cleanUp(workPhone2) + "|" + "workPhone3:" + this.cleanUp(workPhone3) + "|" + "mobilePhone1:" + this.cleanUp(mobilePhone1) + "|" + "mobilePhone2:" + this.cleanUp(mobilePhone2) + "|" + "mobilePhone3:" + this.cleanUp(mobilePhone3);
        var address = "currentAddress1:" + this.cleanUp(currentAddress1) + "|" + "currentAddress2:" + this.cleanUp(currentAddress2) + "|" + "currentAddress3:" + this.cleanUp(currentAddress3);
        var employer = "employerName1:" + this.cleanUp(employerName1) + "|" + "employerName2:" + this.cleanUp(employerName2) + "|" + "employerName3:" + this.cleanUp(employerName3);
        var product = "productName1:" + this.cleanUp(productName1) + "|" + "productName2:" + this.cleanUp(productName2) + "|" + "productName3:" + this.cleanUp(productName3);
        var remark = this.cleanUp(remarks);
        this.init(port, coinBaseAddress);
        var transHash = SkipTraceContract.at(SkipTraceContractAddress).addSkipTraceRecord.sendTransaction(profile, phone, address, employer, product, remark, {from: coinBaseAddress, data:SkipTraceCompiled.CustomerSkipTrace.code, gas: 10000000});
        // console.log("Trans hash generated from Blockchain ->  " + transHash+"\n");
        return transHash;
    },
    updateSkipTraceRecordOnChain: function (port, coinBaseAddress, customerID, firstName, middleName, lastName, aliasName, DOB, SSN, passportNumber, homePhone1, homePhone2, homePhone3, workPhone1, workPhone2, workPhone3, mobilePhone1, mobilePhone2, mobilePhone3, currentAddress1, currentAddress2, currentAddress3, employerName1, employerName2, employerName3, productName1, productName2, productName3, remarks) {
        this.init(port, coinBaseAddress);
        var profile = "firstName:" + this.cleanUp(firstName) + "|" + "middleName:" + this.cleanUp(middleName) + "|" + "lastName:" + this.cleanUp(lastName) + "|" + "aliasName:" + this.cleanUp(aliasName) + "|" + "DOB:" + this.cleanUp(DOB) + "|" + "SSN:" + this.cleanUp(SSN) + "|" + "passportNumber:" + this.cleanUp(passportNumber);
        var phone = "homePhone1:" + this.cleanUp(homePhone1) + "|" + "homePhone2:" + this.cleanUp(homePhone2) + "|" + "homePhone3:" + this.cleanUp(homePhone3) + "|" + "workPhone1:" + this.cleanUp(workPhone1) + "|" + "workPhone2:" + this.cleanUp(workPhone2) + "|" + "workPhone3:" + this.cleanUp(workPhone3) + "|" + "mobilePhone1:" + this.cleanUp(mobilePhone1) + "|" + "mobilePhone2:" + this.cleanUp(mobilePhone2) + "|" + "mobilePhone3:" + this.cleanUp(mobilePhone3);
        var address = "currentAddress1:" + this.cleanUp(currentAddress1) + "|" + "currentAddress2:" + this.cleanUp(currentAddress2) + "|" + "currentAddress3:" + this.cleanUp(currentAddress3);
        var employer = "employerName1:" + this.cleanUp(employerName1) + "|" + "employerName2:" + this.cleanUp(employerName2) + "|" + "employerName3:" + this.cleanUp(employerName3);
        var product = "productName1:" + this.cleanUp(productName1) + "|" + "productName2:" + this.cleanUp(productName2) + "|" + "productName3:" + this.cleanUp(productName3);
        var remark = this.cleanUp(remarks);
        var transHash = SkipTraceContract.at(SkipTraceContractAddress).updateSkipTraceRecord.sendTransaction(customerID, profile, phone, address, employer, product, remark, {from: coinBaseAddress, data:SkipTraceCompiled.CustomerSkipTrace.code, gas: 10000000});
        // console.log("Trans hash generated from Blockchain ->  " + transHash+"\n");
        return transHash;
    },
    getBankAddress : function (name) {
        return web3.db.getString("NameAddressMap", name);
    },
    putBankAddress: function (name, address) {
        var text ='{ "name":"' + name + '", "address":"' + address + '" }';
        web3.db.putString("NameAddressMap", name, text);
    },
    putBankName: function (address, name) {
        var text ='{ "name":"' + name + '", "address":"' + address + '" }';
        web3.db.putString("AddressNameMap", address, text);
    },
    querySkipTraceRecordOnChain: function (customerID) {
        var transHash = SkipTraceContract.at(SkipTraceContractAddress).querySkipTraceRecord.sendTransaction(customerID, {from: coinBaseAddress, data:SkipTraceCompiled.CustomerSkipTrace.code, gas: 10000000});
        console.log("Trans hash generated from Blockchain ->  " + transHash+"\n");
        return transHash;
    },
    getRecordCountOnChain: function () {
        var transHash = SkipTraceContract.at(SkipTraceContractAddress).getRecordCount.sendTransaction({from: coinBaseAddress, data:SkipTraceCompiled.CustomerSkipTrace.code, gas: 10000000});
        console.log("Trans hash generated from Blockchain ->  " + transHash+"\n");
        return transHash;
    },
    resetOnChain: function () {
        var transHash = SkipTraceContract.at(SkipTraceContractAddress).reset.sendTransaction({from: coinBaseAddress, data:SkipTraceCompiled.CustomerSkipTrace.code, gas: 10000000});
        console.log("Trans hash generated from Blockchain ->  " + transHash+"\n");
        return transHash;
    },
    resetOnDB: function () {
        web3.db.putString("CreateLog", "logString", "[]");
        web3.db.putString("UpdateLog", "logString", "[]");
        web3.db.putString("QueryLog", "logString", "[]");
    },
    updateCreateLogOnDB: function (logString) {
        web3.db.putString("CreateLog", "logString", logString);
    },
    printCreateLogFromDB: function () {
        var obj = JSON.parse(web3.db.getString("CreateLog", "logString"));
        for (var i = 0; i < obj.length; i++) {
            console.log("------ Record No: " + (i+1) +"-----");
            console.log(JSON.stringify(obj[i])+"\n");
        }
    },
    isCustRecordPending: function (transHash) {
        var obj = web3.eth.pendingTransactions;
        if (obj != null){
            for (var i = 0; i < obj.length; i++) {
                if (obj[i].hash == transHash) return true;
            }
        }
        return false;
    },
    getUpdateLogFromDB: function () {
        return web3.db.getString("UpdateLog", "logString");
    },
    updateUpdateLogOnDB: function (logString) {
        web3.db.putString("UpdateLog", "logString", logString);
    },
    printUpdateLogFromDB: function () {
        var obj = JSON.parse(web3.db.getString("UpdateLog", "logString"));
        for (var i = 0; i < obj.length; i++) {
            console.log("------ Record No: " + (i+1) +"-----");
            console.log(JSON.stringify(obj[i])+"\n");
        }
    },
    getQueryLogFromDB: function () {
        return web3.db.getString("QueryLog", "logString");
    },
    updateQueryLogOnDB: function (logString) {
        web3.db.putString("QueryLog", "logString", logString);
    },
    printQueryLogFromDB: function () {
        var obj = JSON.parse(web3.db.getString("QueryLog", "logString"));
        for (var i = 0; i < obj.length; i++) {
            console.log("------ Record No: " + (i+1) +"-----");
            console.log(JSON.stringify(obj[i])+"\n");
        }
    },
    deSerialize : function (jsonString) {
        var objResult = JSON.parse(jsonString);
        var addresses = this.splitString(objResult.addresses);
        var bankID = objResult.bankID;
        var customerID = objResult.customerID;
        var employer = this.splitString(objResult.employer);
        var phone = this.splitString(objResult.phone);
        var products = this.splitString(objResult.products);
        var profile = this.splitString(objResult.profile);
        var remarks = objResult.remarks;
        var timestamp = objResult.timestamp;

        var JSONValues ='{ "currentAddress1":"'+ addresses[0]+'",'+'"currentAddress2":"'+addresses[1]+'",'+'"currentAddress3":"'+addresses[2]+'",'+
            '"bankID":"'+ bankID +'",'+
            '"customerID":"'+ customerID +'",'+
            '"employer1":"'+ employer[0]+'",'+'"employer2":"'+employer[1]+'",'+'"employer3":"'+employer[2]+'",'+
            '"homePhone1":"'+ phone[0]+'",'+'"homePhone2":"'+phone[1]+'",'+'"homePhone3":"'+phone[2]+'",'+
            '"workPhone1":"'+ phone[3]+'",'+'"workPhone2":"'+phone[4]+'",'+'"workPhone3":"'+phone[5]+'",'+
            '"mobilePhone1":"'+ phone[6]+'",'+'"mobilePhone2":"'+phone[7]+'",'+'"mobilePhone3":"'+phone[8]+'",'+
            '"product1":"'+ products[0]+'",'+'"product2":"'+products[1]+'",'+'"product3":"'+products[2]+'",'+
            '"firstName":"'+ profile[0]+'",'+'"middleName":"'+profile[1]+'",'+'"lastName":"'+profile[2]+'",'+
            '"aliasName":"'+ profile[3]+'",'+'"DOB":"'+profile[4]+'",'+'"SSN":"'+profile[5]+'",'+
            '"passportNumber":"'+ profile[6]+'",'+'"remarks":"'+remarks+'",'+'"timestamp":"'+timestamp+'"}';

        return JSONValues;
    },
    splitString : function (stringToSplit) {
        var arrayOfStrings = stringToSplit.split("|");
        var arrayOfValues = [];
        for (var i = 0; i < arrayOfStrings.length; i++) {
            var arrayOfkeyValues;
            arrayOfkeyValues = arrayOfStrings[i].split(":");
            arrayOfValues[i] = arrayOfkeyValues[1];
        }
        return arrayOfValues;
    },
    cleanUp : function (str) {
        return (str)? (((str.replace("\"", "~")).replace("\'", "~")).replace("|", "~")).replace(":", "~") : str;
    },
//     watchTransactionEvent: function(self) {
//         console.log('calling watch trans');
//         web3.eth.filter('latest').watch(function(){
//             console.log('Watching for transactions..');
//             self.displayTransactions();
//         });
//     },
//     watchAddEvent: function(self) {
//         console.log('calling watch add');
//         this.web3Init();
//         var addEvent = SkipTraceContract.at(SkipTraceContractAddress).SkipTraceAddEvent();
//         addEvent.watch(function(error, result){
//             console.log('Watching for user add..');
//             var blocks = +sessionStorage.getItem('blocks');
//             var profile = result.args.profile.split('|');
//             var firstName = profile[0].replace('firstName:','');
//             var lastName = profile[2].replace('lastName:', '');
//             console.log(blocks, result, result.blockNumber);
//             if(blocks > 0 && result && result.blockNumber !== blocks) {
//                 $('.customer-added-alert').show();
//                 $('.customer-added-alert').html('Customer record ' + result.args.customerID.c[0] + ' ' + firstName + ' ' + lastName + ' ' + ' successfully created.');
//                 $('.customer-added-alert').delay(notificationDelay).fadeOut();
//             }
//             // addEvent.stopWatching();
//             debugger;sessionStorage.setItem('blocks', result.blockNumber);
//         });
//     },
//     watchUpdateEvent: function(self) {
//         console.log('calling watch update');
//         this.web3Init();
//         var updateEvent = SkipTraceContract.at(SkipTraceContractAddress).SkipTraceUpdateEvent();
//         updateEvent.watch(function(error, result){
//             console.log('Watching for user updates..');
//             var blocks = +sessionStorage.getItem('updateBlocks');
//             var profile = result.args.profile.split('|');
//             var firstName = profile[0].replace('firstName:','');
//             var lastName = profile[2].replace('lastName:', '');
//             if (blocks > 0 && result && result.blockNumber !== blocks) {
//                 $('.customer-updated-alert').show();
//                 $('.customer-updated-alert').html('Customer record ' + result.args.customerID.c[0] + ' ' + firstName + ' ' + lastName + ' ' + ' successfully overwritten.');
//                 $('.customer-updated-alert').delay(notificationDelay).fadeOut();
//             }
//             // updateEvent.stopWatching();
//             sessionStorage.setItem('updateBlocks', result.blockNumber);
//     	});
//     },
//     watchQueryEvent : function(self) {
//         var self2 = this;
//         var queryEvent = SkipTraceContract.at(SkipTraceContractAddress).SkipTraceQueryEvent();
//         queryEvent.watch(function(error, result) {
//             queryEvent.stopWatching();
//         });
//     }
};
