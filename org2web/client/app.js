'use strict';

var app = angular.module('application', []);

app.controller('appController', function($scope, appFactory){

    $("#error_query").hide();
    $("#error_key").hide();
    $("#success_sign").hide();
    $("#access_request").hide();

    $scope.rows = [];

    $scope.registerOrg = function(){

        var name = $scope.org_name;
        appFactory.registerOrg(name, function(data){
            // do something with callback output - append to table
            $scope.rows.push(data);
        });
    }

    $scope.querySign = function() {

        // var org = $scope.signOrg;
        appFactory.querySign(function(data){
            // do something with callback output - filter based on user key and return to scope - sign_record
            var array = [];
            for (var i = 0; i < data.length; i++){
                parseInt(data[i].Key);
                data[i].Record.Key = parseInt(data[i].Key);
                if (data[i].Record.organization === $scope.signOrg) {
                    array.push(data[i].Record);
                }
            }

            array.sort(function(a, b) {
                return parseFloat(a.Key) - parseFloat(b.Key);
            });
            $scope.sign_record = array;
        });
    }

    $scope.decryptRecord = function() {

        var decrypt = $scope.decrypt;
        appFactory.decryptRecord(decrypt, function(data){
            $scope.decrypt_data = data;
        });
    }

    $scope.signRecord = function() {

        var id = $scope.sign_id;
        appFactory.signRecord(id, function(data){
            // transaction id is returned
            $scope.tx_id = data;
            $("#success_sign").show();
        });
    }

    $scope.declineRecord = function() {

        var id = $scope.sign_id;
        appFactory.declineRecord(id, function(data){
            $scope.tx_id = data;
            $("#success_sign").show();
        });
    }

    $scope.requestAccess = function() {

        appFactory.requestAccess($scope.request, function(data) {
            $scope.access_id = data;
            $("#access_request").show();
        });
    }

    $scope.decryptR = function() {

        console.log("testing....")
        appFactory.decryptR($scope.deaccess, function(data) {
            $scope.decryptR_data = data;
        })
    }
});

app.factory('appFactory', function($http){
    var factory = {};

    factory.registerOrg = function(name, callback){
        $http.get('/register_org/'+name).success(function(output){
            callback(output);
        });
    }

    factory.querySign = function(callback){

        $http.get('/get_all_record').success(function(output){
            callback(output);
        });
    }

    factory.decryptRecord = function(data, callback){
        var x = data.id + "-" + data.key;
        $http.get('/decrypt_record/'+x).success(function(output){
            callback(output);
        });
    }

    factory.signRecord = function(id, callback){
        $http.get('/sign_record/'+id).success(function(output){
            callback(output);
        });
    }

    factory.declineRecord = function(id, callback){
        $http.get('/decline_record/'+id).success(function(output){
            callback(output);
        });
    }

    factory.requestAccess = function(data, callback){

        var request = data.id + "-" + data.org;
        $http.get('/request_access/'+request).success(function(output){
            callback(output);
        });
    }

    factory.decryptR = function(data, callback){
        var x = data.id + "-" + data.pub + "-" + data.priv + "-" + data.user;
        console.log(x);
        $http.get('/decrypt_request_access/'+x).success(function(output){
            callback(output);
        });
    }

    return factory;

});

