"use strict";
var bodyparser = require('body-parser');
var express = require('express');
var status = require('http-status');
var mongoose = require('mongoose');

module.exports = function (wagner) {

    var api = express.Router();
    api.use(bodyparser.json());

    mongoose.connect('mongodb://localhost:27017/test', function (err) {
        api.get('/coach/error', function (req, res) {
            res.status(503).json({
                error: err
            });
        });
    });


    api.get('/coach/deleteOne', wagner.invoke(function (Coach) {
        return function (req, res) {
            if (req.query.email !== undefined) {
                Coach.findOne({
                    'profile.email': req.query.email
                }).remove().exec(function (error, coaches) {
                    if (error) {
                        return res.
                        status(status.INTERNAL_SERVER_ERROR).
                        json({
                            error: error.toString()
                        });
                    }
                    res.json({
                        "user": "deleted"
                    });
                });
            } else {
                res.status(400).json({
                    error: "no email specified"
                });
            }
        };
    }));
    api.get('/coach/deleteAll', wagner.invoke(function (Coach) {
        return function (req, res) {
            Coach.find().remove().exec();
            return res.send("drop drop drop the base");
        };
    }));
    api.get('/coach/all', wagner.invoke(function (Coach) {
        return function (req, res) {
            Coach.
            find().
            sort({
                "profile.surname": 1
            }).limit(100).
            exec(function (error, coaches) {
                if (error) {
                    return res.
                    status(status.INTERNAL_SERVER_ERROR).
                    json({
                        error: error.toString()
                    });
                }
                res.json({
                    coaches: coaches
                });
            });
        };
    }));
    api.get('/coach/addRating', wagner.invoke(function (Coach) {
        return function (req, res) {
            var responseMessage = "";
            Coach.findOneAndUpdate({
                    "profile.oauth": req.query.oauth
                }, {
                    $pull: {
                        "rating": {
                            "oauth": req.query.revOAuth
                        }
                    }
                }, {
                    upsert: false
                },
                (err, coaches) => {
                    if (err) return res.status(500).json({
                        error: err
                    });
                    responseMessage += "previous comment delted";
                })
            Coach.findOneAndUpdate({
                    "profile.oauth": req.query.oauth
                }, {
                    $push: {
                        "rating": {
                            "value": req.query.value,
                            "review": req.query.review,
                            "oauth": req.query.revOAuth
                        }
                    }
                }, {
                    upsert: false
                },
                (err, coaches) => {
                    if (err) return res.status(500).json({
                        error: err
                    });
                    return res.json({
                        "rating": [responseMessage, "new comment inserted"]
                    });
                })

        }
    }));
    api.get('/coach/searchCategories', wagner.invoke(function (Coach) {
        return function (req, res) {
            var searchObject = {};
            let limit = req.query.limit != null ? req.query.limit : 100;
            let sortParameter = {};
            if (req.query.sort != null) {
                if (req.query.order !== undefined) {
                    var order = Number(req.query.order);
                } else {
                    res.json({
                        "sort order": "undefined"
                    });
                    return;
                }
                switch (req.query.sort) {
                    case "primaryPrice":
                        sortParameter["description.subjects.primaryPrice"] = order;
                        break;
                    case "secondaryPrice":
                        sortParameter["description.subjects.secondaryPrice"] = order;
                        break;
                    case "highschoolPrice":
                        sortParameter["description.subjects.highschoolPrice"] = order;
                        break;
                    case "uniPrice":
                        sortParameter["description.subjects.uniPrice"] = order;
                        break;
                    case "average":
                        sortParameter["averageRating"] = order;
                        break;
                }
            }
            try {
                parseSearchCall(searchObject, req);
            } catch (err) {
                res.status(400).json({
                    error: err
                });
                return;
            }
            Coach.find(searchObject).limit(limit).sort({
                'description.subjects.uniPrice': 1
            }).
            exec(function (error, coaches) {
                if (error) {
                    return res.
                    status(status.INTERNAL_SERVER_ERROR).
                    json({
                        error: error.toString()
                    });
                }
                res.json({
                    coaches: coaches,
                });
            });
        };
    }));
    api.get('/coach/heartbeat', function (req, res) {
        res.status(200).send({
            api: "online"
        });
    });
    api.post('/coach/new', wagner.invoke(function (Coach) {
        return function (req, res) {
            var newbie = new Coach();
            newbie.profile = req.body.profile;
            newbie.description = req.body.description;
            newbie.loc = req.body.loc;
            newbie.rating = req.body.rating;
            Coach.findOne({
                "profile.oauth": req.body.profile.oauth
            }, (err, coach) => {
                if (err) {
                    return res.
                    status(status.INTERNAL_SERVER_ERROR).
                    json({
                        error: error.toString()
                    });
                }
                if (coach != null) {
                    Coach.update({
                        "profile.oauth": req.body.profile.oauth
                    }, {
                        $set: {
                            "profile": req.body.profile,
                            "description": req.body.description,
                            "loc": req.body.loc,
                            "rating": req.body.rating
                        }
                    }, {
                        upsert: false
                    }, (err, coach) => {
                        if (err) return res.status(500).json({
                            error: err
                        });

                        return res.json({
                            "succesfully saved": "user modified"
                        });
                    })
                } else {
                    newbie.save((err, user) => {
                        if (err) {
                            return res.
                            status(status.INTERNAL_SERVER_ERROR).
                            json({
                                error: err.toString()
                            });
                        }
                        return res.json({
                            "succesfully saved": "new user created"
                        });
                    })
                }
            })


        };
    }));
    return api;
};

function parseSearchCall(searchObject, req) {
    for (let field in req.query) {
        if (field == "name") {
            searchObject['profile.name'] = req.query.name;
        }
        if (field == "surname") {
            searchObject['profile.surname'] = req.query.surname;
        }
        if (field == "email") {
            searchObject['profile.email'] = req.query.email;
        }
        if (field == "oauth") {
            searchObject['profile.ouath'] = req.query.ouath;
        }
        if (field == "subjects") {
            if (req.query.subjects.constructor === Array) {
                searchObject["description.subjects.name"] = {
                    $in: req.query.subjects
                }
            } else {
                searchObject["description.subjects.name"] = {
                    $in: [req.query.subjects]
                }
            }
        }
        if (field == "level") {
            if (req.query.lowEnd == undefined || req.query.highEnd == undefined) {
                throw "lowEnd and highEnd unspecified";
            }
            if (req.query.level.constructor === Array) {
                for (let i = 0; i < req.query.level.length; i++) {
                    searchObject["description.subjects." + req.query.level[i]] = {
                        $gt: req.query.lowEnd,
                        $lt: req.query.highEnd
                    }
                }
            } else {
                searchObject["description.subjects." + req.query[field]] = {
                    $gt: req.query.lowEnd,
                    $lt: req.query.highEnd
                }
            }

        }
        if (field == "longitude") {
            if (req.query.radius == undefined || req.query.lattitude == undefined) {
                throw "radius or lattitude unspecified";
            }
            searchObject["loc.geometry"] = {
                $nearSphere: {
                    $geometry: {
                        type: "Point",
                        coordinates: [Number(req.query.longitude), Number(req.query.lattitude)]
                    },
                    $maxDistance: Number(req.query.radius) * 1000
                }
            }
        }

    }
    

}