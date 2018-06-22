var record = require('./controller.js');

module.exports = function(app){

  app.get('/get_record/:id', function(req, res){
    record.get_record(req, res);
  });

  app.get('/create_record/:record', function(req, res){
    record.create_record(req, res);
  });

  app.get('/get_all_record', function(req, res){
    record.get_all_record(req, res);
  });
  
}
