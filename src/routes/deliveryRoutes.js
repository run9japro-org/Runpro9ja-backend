import express from 'express';
import { authGuard } from '../middlewares/auth.js';
import * as deliveryController from '../controllers/deliveryController.js';


const router = express.Router();


// Agent updates order location
router.patch('/:id/location', authGuard, deliveryController.updateLocation);


// Customer fetches live order location (fallback)
router.get('/:id/location', authGuard, deliveryController.getLiveLocation);


export default router;