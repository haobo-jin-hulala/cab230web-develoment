var express = require('express');
var router = express.Router();
const secretKey = "secret key";
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const moment = require('moment')

router.post('/register', function (req, res, next) {
  //check if email and password exit
  if ((!req.body.email) || (!req.body.password)) {
    res.status(400).json({
      error: true,
      message: "Request body incomplete, both email and password are required"
    });
    return;
  }
  //check email format
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(req.body.email)) {
    res.status(400).json({
      Error: true,
      Message: "invalid email"
    });
    return;
  }

  req.db.from("users").select("*").where("email", "=", req.body.email)
    .then((rows) => {
      //check if the same email already registered
      if (Object.keys(rows).length > 0) {
        res.status(409).json({ "error": true, "message": "User already exists" });
        return;
      }
      else {
        //password encryption
        const saltRounds = 10
        const hash = bcrypt.hashSync(req.body.password, saltRounds)
        req.db.from('users').insert({ email: req.body.email, hash: hash })
          .then(() => {
            res.status(201).json({
              message: "User created"
            });
          })
          .catch(err => {
            console.log(err);
            res.status(500).json({
              error: true,
              message: "Error in MySQL query"
            })
          });
      }
    })
    .catch((err) => {
      console.log(err)
      res.json({ error: true, message: "Error in MySQL query" })
    })

});


router.post('/login', function (req, res, next) {
  if ((!req.body.email) || (!req.body.password)) {
    res.status(400).json({
      "error": true,
      "message": "Request body incomplete, both email and password are required"
    });
  } else {
    req.db.from('users').select('*').where('email', '=', req.body.email)
      .then((users) => {
        if (users.length === 0) {
          res.status(401).json({ "error": true, "message": "Incorrect email or password" });
          return;
        } else {

          const user = users[0];
          //password decryption
          bcrypt.compare(req.body.password, user.hash).then(function (result) {
            if (result == false) {
              res.status(401).json({ error: true, message: "Incorrect email or password" })
              return
            } else {
              //set expires time
              const secretKey = "secret key";
              const expires_in = 60 * 60 * 24; // 1day
              const exp = Date.now() + expires_in * 1000;
              const email = req.body.email
              //get token
              const token = jwt.sign({ email, exp }, secretKey);
              res.status(200).json({ token: token, token_type: "Bearer", "expires_in": expires_in })
            }
          });
          // if (!bcrypt.compare(req.body.password, user.hash)) {

          //   res.status(401).json({ error: true, message: "Incorrect email or password" })
          //   return;
          // }
        }


      })
      .catch((err) => {
        console.log(err)
        res.json({ "Error": true, "Messages": "Error in MySQL query" })
      })
  }
});



router.get("/:email/profile", function (req, res, next) {
  //for unauthorization(no token) query
  const publicQuery = req.db.from("users")
    .select(
      "email",
      "firstName",
      "lastName")
    .where("email", "=", req.params.email)
  //for authorization query
  const authorizationQuery = req.db.from("users")
    .select(
      "email",
      "firstName",
      "lastName",
      "dob",
      "address")
    .where("email", "=", req.params.email)

  // search without token
  if (!req.headers.authorization) {
    publicQuery
      .then((rows) => {
        if (rows.length === 0) {
          res.status(404).json(
            {
              error: true,
              message: "User not found"
            }
          )
          return;
        } else {
          res.status(200).json(rows[0])
        }
      })

  } else {
    //search with token

    const authorization = req.headers.authorization;
    //check token format
    let token = null;
    if (authorization && authorization.split(" ").length === 2) {
      token = authorization.split(" ")[1];
    }

    let decoded = 0
    //check expire time of token
    try {
      decoded = jwt.verify(token, secretKey)
      if (decoded.exp < Date.now()) {
        res.status(401).json({ error: true, "Message": "Token has expired" });
        return;
      }

    } catch (e) {
      console.log(e)
      res.status(401).json({ error: true, "Message": "Token is not valid " });
      return
    }
    // if email is correct,return all information
    if (decoded.email === req.params.email) {
      authorizationQuery
        .then((rows) => {
          if (rows.length === 0) {
            res.status(404).json({
              error: true,
              message: "User not found"
            })
            return;
          }
          else {
            //set the dob to the specified data format
            let data = moment(rows[0].dob).format("YYYY-MM-DD");
            //if dob exist,return data field,else, return null  
            if (data != 'Invalid date') {
              rows[0].dob = data
            }
            res.status(200).json(rows[0]);
          }
        }
        )
    } else if (decoded.email !== req.params.email) {
      publicQuery
        .then((rows) => {
          if (rows.length === 0) {
            res.status(404).json({
              error: true,
              message: "User not found"
            })
            return;
          }
          else {
            res.status(200).json(rows[0]);
          }
        }
        )
    }
  }
})

//middleware to check token format and expired time
const authorize_Public = (req, res, next) => {

  const authorization = req.headers.authorization;
  let token = null;
  //retrieve token
  if (authorization && authorization.split(" ").length === 2) {
    token = authorization.split(" ")[1];
  }
  req.db.select("email").from("users").where("email", "=", req.params.email)
    .then((users) => {
      if (users.length === 0) {
        res.status(403).json(
          {
            error: true,
            message: "Forbidden"
          }
        )
        return;
      } else {
        //verify JWT and check expiration date
        try {
          const decoded = jwt.verify(token, secretKey)
          if (decoded.exp < Date.now() || decoded.email !== req.params.email) {
            res.status(403).json({ error: true, message: "Forbidden" });
            return;
          }
          //if token is valid,jump to next router.else,end run
          next()

        } catch (e) {
          console.log(e)
          res.status(401).json({ error: true, message: "Token is not valid:", e });
        }
      }
    })

}


router.put("/:email/profile", authorize_Public, function (req, res, next) {
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const dob = req.body.dob;
  const address = req.body.address;
  const email = req.params.email;

  console.log(firstName + "+" + lastName + "+" + dob + "+" + address)
  if (!firstName || !lastName || !dob || !address) {
    res.status(400).json({
      error: true,
      message: "Request body incomplete: firstName, lastName, dob and address are required."
    })
    return;
  }
  //check field format
  if (typeof (firstName) !== "string" || typeof (lastName) !== "string" || typeof (dob) !== "string" || typeof (address) !== "string") {
    res.status(400).json(
      {
        error: true,
        message: "Request body invalid: firstName, lastName and address must be strings only."
      }
    )
    return;
  }
  //regular expression for date 
  var dateFormat = /^((((19|20)\d{2})-(0?[13-9]|1[012])-(0?[1-9]|[12]\d|30))|(((19|20)\d{2})-(0?[13578]|1[02])-31)|(((19|20)\d{2})-0?2-(0?[1-9]|1\d|2[0-8]))|((((19|20)([13579][26]|[2468][048]|0[48]))|(2000))-0?2-29))$/;
  // Check if the date string format is a match
  if (!dob.match(dateFormat)) {
    res.status(400).json(
      {
        error: true,
        message: "Invalid input: dob must be a real date in format YYYY-MM-DD."
      }
    )
    return;
  }
  //change dob data type to data
  var selectedDate = dob.split(" ")[0].split("-");
  var currentDate = new Date(selectedDate[0], selectedDate[1] - 1, selectedDate[2]);
  //compare dob with current time
  if (currentDate > Date.now()) {
    res.status(400).json({
      error: true,
      message: "Invalid input: dob must be a date in the past."
    })
    return
  }

  const updateInfo = {
    "firstName": firstName,
    "lastName": lastName,
    "dob": dob,
    "address": address
  }

  req.db.from("users").where("email", "=", email).update(updateInfo)
    .then(
      (rows) => {
        res.status(200).json({
          email,
          firstName,
          lastName,
          dob,
          address,
        })
      }
    )
})
module.exports = router;
