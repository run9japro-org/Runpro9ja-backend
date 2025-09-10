import { ServiceCategory } from '../models/ServiceCategory.js';


export const createCategory = async (req, res, next) => {
try {
const { name, description, subcategories = [] } = req.body;
if (!name) return res.status(400).json({ message: 'Name required' });
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const existing = await ServiceCategory.findOne({ $or: [{ name }, { slug }] });
if (existing) return res.status(409).json({ message: 'Category exists' });
const cat = await ServiceCategory.create({ name, slug, description, subcategories, createdBy: req.user.id });
res.status(201).json(cat);
} catch (e) { next(e); }
};


export const listCategories = async (req, res, next) => {
try {
const cats = await ServiceCategory.find().sort('name');
res.json(cats);
} catch (e) { next(e); }
};


export const getCategory = async (req, res, next) => {
try {
const cat = await ServiceCategory.findById(req.params.id);
if (!cat) return res.status(404).json({ message: 'Not found' });
res.json(cat);
} catch (e) { next(e); }
};


export const updateCategory = async (req, res, next) => {
try {
const { name, description, subcategories } = req.body;
const cat = await ServiceCategory.findById(req.params.id);
if (!cat) return res.status(404).json({ message: 'Not found' });
if (name) { cat.name = name; cat.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
if (description !== undefined) cat.description = description;
if (subcategories !== undefined) cat.subcategories = subcategories;
await cat.save();
res.json(cat);
} catch (e) { next(e); }
};


export const deleteCategory = async (req, res, next) => {
try {
await ServiceCategory.findByIdAndDelete(req.params.id);
res.json({ message: 'Deleted' });
} catch (e) { next(e); }
};