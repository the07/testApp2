var peoplechain = require('./controller.js');

module.exports = function(app){

    app.get('/register_org/:name', function(req, res){
        peoplechain.register_org(req, res);
    });

    app.get('/get_all_record', function(req, res){
        peoplechain.get_all_record(req, res);
    });

    app.get('/decrypt_record/:data', function(req, res){
        peoplechain.decrypt_record(req, res);
    });

    app.get('/sign_record/:id', function(req, res){
        peoplechain.sign_record(req, res);
    });

    app.get('/decline_record/:id', function(req, res){
        peoplechain.decline_record(req, res);
    });
}
