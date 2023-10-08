var express = require('express');
var router = express.Router();
var jwt = require("jsonwebtoken");
const secretKey = "secret key";


router.get('/countries', function (req, res, next) {
  //select countries from database
  req.db.from('data').pluck("country").distinct("country").orderBy('country')
    .then(rows => {
      if (rows.length > 0) {
        res.status(200).json(rows)
      } else {
        res.status(400).json({
          error: true,
          message: "Invalid query parameters. Query parameters are not permitted."
        })
      }
    })
    .catch(err => {
      console.log(err);
      res.json({ "Error": true, "Message": "Error in MySQL query" });
    }
    )
});






router.get('/volcanoes', function (req, res, next) {
  const populatedWithin = req.query.populatedWithin
  //Judge the query length, if the query is greater than 1 and one of country and populatedWithin is empty, it means that there is an error field
  if (Object.keys(req.query).length > 1 && (!req.query.country || !req.query.populatedWithin)) {
    res.status(400).json({
      error: true,
      message: "Invalid query parameters. Only populatedWithin and country are permitted."
    })
    return;
  }
  // if valid parameters
  if (req.query.country && req.query.populatedWithin) {
    if (populatedWithin != "5km" && populatedWithin != "10km" && populatedWithin != "30km" && populatedWithin != "100km") {
      res.status(400).json({
        error: true,
        message: "Invalid query parameters. "
      })
      return;
    }
    req.db.from('data').select("id", "name", "country", "region", "subregion").where('country', "=", req.query.country).where("population_" + populatedWithin, "!=", 0).orderBy("id")
      .then((rows) => {
        res.status(200).json(rows)
      })
      .catch((err) => {
        console.log(err)
        res.json({ error: true, message: "Error" })
      })
    //if populatedWithin not exist,return all of the country
  } else if (req.query.country && !req.query.populatedWithin) {
    req.db.from('data').select("id", "name", "country", "region", "subregion").where('country', "=", req.query.country).orderBy("id")
      .then((rows) => {
        res.status(200).json(rows)
      })
      .catch((err) => {
        res.json({ error: true, message: "Error in MySQL query" })
      })
  }
  else {
    res.status(400).json({ error: true, message: "Country is a required query parameter." })
  }

});

router.get('/volcano/:id', function (req, res, next) {
  //test Invalid parameters id
  if (isNaN(req.params.id)) {
    res.status(400).json({ error: true, message: "Invalid query parameters. Query parameters are not permitted." })
  } else {
    //with token
    if (req.headers.authorization) {
      const authorization = req.headers.authorization;
      let token = null;
      console.log("xxxxxx")
      //retrieve token
      if (authorization && authorization.split(" ").length === 2) {
        token = authorization.split(" ")[1];
      } else {
        res.status(401).json({
          error: true,
          message: "Authorization header is malformed"
        })
        return;
      }

      //verify JWT and check expiration date
      try {
        const decoded = jwt.verify(token, secretKey)
        if (decoded.exp < Date.now()) {

          res.status(401).json({ error: true, message: "Token has expired" });
          return;
        }

      } catch (e) {
        console.log(e)
        res.status(401).json({ error: true, message: "Invalid JWT token" });
        return;
      }

      req.db.from('data').select('*').where('id', '=', req.params.id)
        .then((rows) => {
          //the id not found in database
          if (Object.keys(rows).length === 0) {
            res.status(404).json({ error: true, message: "Volcano with ID: " + req.params.id + " not found" })
          }
          else {
            res.status(200).json(rows[0])
          }
        })
        .catch((err) => {
          res.json({ error: true, message: "Error in MySQL query" })
        })
    } else {
      //without token
      req.db.from('data').select("id", "name", "country", "region", "subregion", "last_eruption", "summit", "elevation", "latitude", "longitude").where('id', '=', req.params.id)
        .then((rows) => {
          if (Object.keys(rows).length === 0) {
            res.status(404).json({ error: true, message: "Volcano with ID: " + req.params.id + " not found" })
          }
          else {
            res.status(200).json(rows[0])
          }
        })
        .catch((err) => {
          res.json({ error: true, message: "Error in MySQL query" })
        })
    }


  }

})
router.get('/me', function (req, res, next) {
  res.status(200).json(
    {
      "name": "Haobo Jin",
      "student_number": "n10642536"
    }
  )
})
module.exports = router;
