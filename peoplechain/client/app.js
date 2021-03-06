// SPDX-License-Identifier: Apache-2.0

'use strict';

var app = angular.module('application', []);

// Angular Controller
app.controller('appController', function($scope, appFactory){

	$("#success_holder").hide();
	$("#success_create").hide();
	$("#error_holder").hide();
	$("#error_query").hide();
	$("#error_key").hide();
	$("#access_sign").hide();

	$scope.queryAllRecord = function(){

		appFactory.queryAllRecord(function(data){
			var array = [];
			for (var i = 0; i < data.length; i++){
				parseInt(data[i].Key);
				data[i].Record.Key = parseInt(data[i].Key);
				array.push(data[i].Record);
			}
			array.sort(function(a, b) {
			    return parseFloat(a.Key) - parseFloat(b.Key);
			});
			$scope.all_record = array;
		});
	}

	$scope.generateUserKey = function() {

		appFactory.generateUserKey($scope.user, function(data){
			$scope.key = data;
			$("#generate_form").hide();
		});
	}

	$scope.createRecord = function() {


		var array = $scope.private;
		var array_record = $scope.record;

		var private_data = {};

		// Split the private and public data

		for (var i = 0; i < Object.keys(array).length; i++){
			// Object.keys(array)[i]
			private_data[Object.keys(array)[i]] = array_record[Object.keys(array)[i]];
			delete array_record[Object.keys(array)[i]];
		}		

		// Add private and public data items as string
		var record = array_record.id + "-" + array_record.pubkey + "-" + array_record.privkey + "-" + array_record.orgkey;
		var record_data = {};
		for (var j=4; j < Object.keys(array_record).length; j++) {
			record_data[Object.keys(array_record)[j]] = array_record[Object.keys(array_record)[j]];
		}

		record = record + "-" + JSON.stringify(private_data);
		record = record + "-" + JSON.stringify(record_data);

		console.log(record);

		// Send the string to factory
		appFactory.createRecord(record, function(data){
			$scope.create_record = data;
			$("#success_create").show();
		});
	}
	
	$scope.queryRecord = function() {

		var id = $scope.record_id;

		appFactory.queryRecord(id, function(data){
			$scope.query_record = data;

			if ($scope.query_record == "Could not locate record") {
				console.log();
				$("#error_query").show();
			} else {
				$("#error_query").hide();
			}
		});
	}

	$scope.allowAccess = function() {
		// need 4 arguments from $scope.access

		appFactory.allowAccess($scope.access, function(data){
			$scope.access_sign_id = data;
			$("#access_sign").show();
		});
	}

	$scope.declineAccess = function() {
		// need 2 arguments from $scope.access
		appFactory.declineAccess($scope.access, function(data){
			$scope.access_sign_id = data;
			$("#access_sign").show();
		});
	}

});

// Angular Factory
app.factory('appFactory', function($http){

	var factory = {};

  	factory.queryAllRecord = function(callback){
  		$http.get('/get_all_record').success(function(output){
			callback(output)
		});
	}

	factory.generateUserKey = function(data, callback){
		var user = data.first + "-" + data.last;
		$http.get('/generate_key/'+user).success(function(output){
			callback(output)
		});
	}

	factory.createRecord = function(data, callback){

		$http.get('/create_record/'+data).success(function(output){
			callback(output)
		});
	}

	factory.queryRecord = function(id, callback) {
		$http.get('/get_record/'+id).success(function(output){
			callback(output)
		});
	}

	factory.allowAccess = function(data, callback) {

		var details = data.id + "-" + data.org + "-" + data.priv;
		$http.get('/grant_access/'+details).success(function(output){
			callback(output)
		});
	}

	factory.declineAccess = function(data, callback) {
		var details = data.id + "-" + data.org;
		$http.get('/decline_access/'+details).success(function(output){
			callback(output)
		});
	}

	return factory;
});
