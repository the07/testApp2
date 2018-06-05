// SPDX-License-Identifier: Apache-2.0

'use strict';

var app = angular.module('application', []);

// Angular Controller
app.controller('appController', function($scope, appFactory){

	$("#success_holder").hide();
	$("#success_create").hide();
	$("#error_holder").hide();
	$("#error_query").hide();

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
			$scope.all_tuna = array;
		});
	}

	$scope.queryRecord = function(){

		var id = $scope.tuna_id;

		appFactory.queryRecord(id, function(data){
			$scope.query_tuna = data;

			if ($scope.query_tuna == "Could not locate tuna"){
				console.log()
				$("#error_query").show();
			} else{
				$("#error_query").hide();
			}
		});
	}

	$scope.createRecord = function(){

		appFactory.createRecord($scope.tuna, function(data){
			$scope.create_tuna = data;
			$("#success_create").show();
		});
	}

});

// Angular Factory
app.factory('appFactory', function($http){

	var factory = {};

    factory.queryAllRecord = function(callback){

    	$http.get('/get_all_record/').success(function(output){
			callback(output)
		});
	}

	factory.queryRecord = function(id, callback){
    	$http.get('/get_record/'+id).success(function(output){
			callback(output)
		});
	}

	factory.createRecord = function(data, callback){

		var record = data.id + "-" + data.user + "-" + data.timestamp + "-" + data.organization;

    	$http.get('/add_record/'+record).success(function(output){
			callback(output)
		});
	}

	return factory;
});
