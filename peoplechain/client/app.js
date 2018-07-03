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

		appFactory.createRecord($scope.record, function(data){
			$scope.create_record = data;
			$("#success_create").show();
		})
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
		var record = data.id + "-" + data.pubkey + "-" + data.privkey + "-" + data.orgkey;
		
		var record_data = {};
		for (var i=4; i < Object.keys(data).length; i++) {
			record_data[Object.keys(data)[i]] = data[Object.keys(data)[i]];
		}
		
		console.log(JSON.stringify(record_data));

		record = record + "-" + JSON.stringify(record_data);

		$http.get('/create_record/'+record).success(function(output){
			callback(output)
		});
	}

	factory.queryRecord = function(id, callback) {
		$http.get('/get_record/'+id).success(function(output){
			callback(output)
		});
	}

	return factory;
});
