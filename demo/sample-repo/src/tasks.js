const { formatResponse } = require('./utils');
const Task = require('./models/Task');

// TODO: add pagination support

const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ 
      userId: req.user.id 
    }).sort({ createdAt: -1 });
    res.json(formatResponse(true, 'Tasks fetched', tasks));
  } catch (err) {
    res.status(500).json(formatResponse(false, 'Server error'));
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const task = await Task.create({
      title,
      description,
      priority: priority || 'medium',
      userId: req.user.id
    });
    res.status(201).json(
      formatResponse(true, 'Task created', task)
    );
  } catch (err) {
    res.status(500).json(formatResponse(false, 'Server error'));
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!task) return res.status(404).json(
      formatResponse(false, 'Task not found')
    );
    res.json(formatResponse(true, 'Task updated', task));
  } catch (err) {
    res.status(500).json(formatResponse(false, 'Server error'));
  }
};

const deleteTask = async (req, res) => {
  try {
    await Task.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.id 
    });
    res.json(formatResponse(true, 'Task deleted'));
  } catch (err) {
    res.status(500).json(formatResponse(false, 'Server error'));
  }
};

module.exports = { getTasks, createTask, updateTask, deleteTask };
