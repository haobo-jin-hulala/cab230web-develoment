const express = require('express');
const router = express.Router();
const swaggerUI = require('swagger-ui-express');
const swaggerDocument = require('../docs/swagger.json');

//The default expansion depth for models (set to -1 completely hide the models).
const opt = {
    swaggerOptions: {
        defaultModelsExpandDepth: -1
    }
}
router.use('/', swaggerUI.serve)
router.get('/', swaggerUI.setup(swaggerDocument, opt))

module.exports = router;