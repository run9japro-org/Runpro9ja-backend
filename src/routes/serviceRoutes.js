import { Router } from 'express';
import {
createCategory,
listCategories,
getCategory,
updateCategory,
deleteCategory
} from '../controllers/serviceCategoryController.js';
import { authGuard, requireAdmin } from '../middlewares/auth.js';


const router = Router();


// Admin only: create/update/delete categories
router.post('/', authGuard, requireAdmin, createCategory);
router.get('/', listCategories);
router.get('/:id', getCategory);
router.put('/:id', authGuard, requireAdmin, updateCategory);
router.delete('/:id', authGuard, requireAdmin, deleteCategory);


export default router;