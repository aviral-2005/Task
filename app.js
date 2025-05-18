// Global Variables
let tasks = [];
let sortableLists = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadTasksFromStorage();
    initializeSortable();
    setupEventListeners();
    initializeStats();
    updateUI();
    new NotificationSystem(); // Make sure this line is present
}

// Event Listeners Setup
function setupEventListeners() {
    // Form submission
    document.getElementById('add-task-form').addEventListener('submit', handleAddTask);
    
    // Search functionality
    document.querySelector('.search-input').addEventListener('input', handleSearch);
    
    // Toggle completed section
    document.getElementById('toggle-completed').addEventListener('click', toggleCompletedSection);
    
    // Floating add button
    document.getElementById('floating-add-btn').addEventListener('click', () => {
        document.getElementById('task-description').focus();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'n') {
                e.preventDefault();
                document.getElementById('task-description').focus();
            } else if (e.key === 'f') {
                e.preventDefault();
                document.querySelector('.search-input').focus();
            } else if (e.key === 's') { // Added shortcut for stats
                e.preventDefault();
                showStats();
            }
        }
    });

    // Stats button
    document.querySelector('.stats-btn').addEventListener('click', showStats);
    
    // Export button
    document.querySelector('.export-btn').addEventListener('click', () => {
        const format = window.confirm('Export as PDF? (Cancel for JSON)') ? 'pdf' : 'json';
        if (format === 'pdf') {
            exportToPDF();
        } else {
            exportTasks();
        }
    });
    
    // Import button
    document.querySelector('.import-btn').addEventListener('click', importTasks);
    
    // Notification button
    document.querySelector('.notification-btn').addEventListener('click', () => {
        notificationSystem.checkPermission();
    });
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            
            // Create backdrop if it doesn't exist
            let backdrop = document.querySelector('.sidebar-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'sidebar-backdrop';
                document.body.appendChild(backdrop);
                
                // Close sidebar when clicking backdrop
                backdrop.addEventListener('click', () => {
                    sidebar.classList.remove('active');
                });
            }
        });
    }
}

// Task Management Functions
function handleAddTask(e) {
    e.preventDefault();
    
    const description = document.getElementById('task-description').value;
    const priority = document.getElementById('task-priority').value;
    const dueDate = document.getElementById('task-due-date').value;

    if (!description || !priority) return;

    const newTask = {
        id: generateTaskId(),
        description,
        priority,
        dueDate,
        completed: false,
        createdAt: new Date().toISOString()
    };

    tasks.push(newTask);
    saveTasksToStorage();
    updateUI();
    
    // Reset form
    e.target.reset();
}

function deleteTask(taskId) {
    tasks = tasks.filter(task => task.id !== taskId);
    saveTasksToStorage();
    updateUI();
}

function toggleTaskComplete(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveTasksToStorage();
        updateUI();
        // Add this line to update stats when task status changes
        if (document.querySelector('.stats-modal.active')) {
            updateStats();
        }
    }
}
// UI Update Functions
function updateUI() {
    updateTaskLists();
    updateProgress();
    updateEmptyStates();
    updateSidebarStats();
}
function updateSidebarStats() {
    // Update active tasks count (non-completed tasks)
    const activeTasks = tasks.filter(task => !task.completed).length;
    const activeTasksElement = document.getElementById('sidebar-active-count');
    if (activeTasksElement) {
        activeTasksElement.textContent = activeTasks;
    }

    // Update due today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueTodayTasks = tasks.filter(task => {
        if (!task.dueDate || task.completed) return false;
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
    }).length;
    const dueTodayElement = document.getElementById('sidebar-due-count');
    if (dueTodayElement) {
        dueTodayElement.textContent = dueTodayTasks;
    }
}

function updateTaskLists() {
    const priorities = ['high', 'medium', 'low'];
    
    priorities.forEach(priority => {
        const list = document.getElementById(`${priority}-priority-tasks`);
        const activeTasks = tasks.filter(task => 
            task.priority === priority && !task.completed
        );
        
        list.innerHTML = '';
        activeTasks.forEach(task => {
            list.appendChild(createTaskElement(task));
        });
    });

    // Update completed tasks
    const completedList = document.getElementById('completed-tasks');
    const completedTasks = tasks.filter(task => task.completed);
    completedList.innerHTML = '';
    completedTasks.forEach(task => {
        completedList.appendChild(createTaskElement(task));
    });
}

function updateProgress() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;

    document.getElementById('progress-percentage').textContent = `${percentage}%`;
    document.getElementById('progress-bar').style.width = `${percentage}%`;
    document.getElementById('completed-count').textContent = completed;
    document.getElementById('total-count').textContent = total;
}

function updateEmptyStates() {
    const priorities = ['high', 'medium', 'low', 'completed'];
    
    priorities.forEach(priority => {
        const emptyElement = document.getElementById(`empty-${priority}`);
        const tasksList = priority === 'completed' 
            ? tasks.filter(task => task.completed)
            : tasks.filter(task => task.priority === priority && !task.completed);
        
        emptyElement.style.display = tasksList.length === 0 ? 'block' : 'none';
    });
}
// Search Function
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const taskElements = document.querySelectorAll('.task-item');

    taskElements.forEach(element => {
        const description = element.querySelector('.task-description').textContent.toLowerCase();
        element.style.display = description.includes(searchTerm) ? '' : 'none';
    });
}

// Drag and Drop
function initializeSortable() {
    const taskLists = document.querySelectorAll('.task-list');
    
    taskLists.forEach(list => {
        new Sortable(list, {
            group: 'shared',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                const taskId = evt.item.getAttribute('data-task-id');
                const newPriority = evt.to.getAttribute('data-priority');
                const task = tasks.find(t => t.id === taskId);
                
                if (task && newPriority) {
                    task.priority = newPriority;
                    saveTasksToStorage();
                    updateUI();
                }
            }
        });
    });
}

// Storage Functions
function saveTasksToStorage() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function loadTasksFromStorage() {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
}

// Stats Functions
function initializeStats() {
    // Create stats modal if it doesn't exist
    if (!document.querySelector('.stats-modal')) {
        const statsModal = createStatsModal();
        document.body.appendChild(statsModal);
    }
}

function createStatsModal() {
    const modal = document.createElement('div');
    modal.className = 'stats-modal';
    modal.innerHTML = `
        <div class="stats-content">
            <div class="stats-header">
                <h2>Task Statistics</h2>
                <button class="close-stats">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="stats-body">
                <div class="stats-summary">
                    <div class="main-stats">
                        <div class="stat-item primary">
                            <h3>Total Tasks</h3>
                            <p id="total-tasks">0</p>
                        </div>
                        <div class="stat-item primary">
                            <h3>Completed Tasks</h3>
                            <p id="completed-tasks">0</p>
                        </div>
                        <div class="stat-item primary">
                            <h3>Completion Rate</h3>
                            <p id="completion-rate">0%</p>
                        </div>
                    </div>
                </div>

                <div class="stats-details">
                    <div class="priority-stats">
                        <h3>Priority Distribution</h3>
                        <div class="chart-container">
                            <div class="chart-bars">
                                <div class="chart-bar high">
                                    <span class="chart-value" id="high-priority">0</span>
                                    <div class="chart-label">High</div>
                                </div>
                                <div class="chart-bar medium">
                                    <span class="chart-value" id="medium-priority">0</span>
                                    <div class="chart-label">Medium</div>
                                </div>
                                <div class="chart-bar low">
                                    <span class="chart-value" id="low-priority">0</span>
                                    <div class="chart-label">Low</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="timeline-stats">
                        <div class="stat-item">
                            <h3>Due Today</h3>
                            <p id="due-today">0</p>
                        </div>
                        <div class="stat-item">
                            <h3>Overdue</h3>
                            <p id="overdue">0</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    modal.querySelector('.close-stats').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    return modal;
}
function showStats() {
    const statsModal = document.querySelector('.stats-modal');
    statsModal.classList.add('active');
    updateStats();
}

function updateStats() {
    const stats = calculateStats();
    console.log('Stats:', stats); // Debug log

    // Get the completed tasks element and log its details
    const completedTasksElement = document.querySelector('.stats-modal .stat-item p#completed-tasks');
    console.log('Completed tasks element:', completedTasksElement);

    // Update basic stats with error checking
    try {
        document.getElementById('total-tasks').textContent = stats.totalTasks;
        
        // Try multiple selectors for completed tasks
        if (completedTasksElement) {
            completedTasksElement.textContent = stats.completedTasks;
            console.log('Updated completed tasks to:', stats.completedTasks);
        } else {
            console.error('Could not find completed tasks element');
            // Try alternative selectors
            const alternativeElement = document.querySelector('.stats-modal [id*="completed"]');
            if (alternativeElement) {
                alternativeElement.textContent = stats.completedTasks;
                console.log('Updated completed tasks using alternative selector');
            }
        }

        document.getElementById('completion-rate').textContent = `${stats.completionRate}%`;
        document.getElementById('high-priority').textContent = stats.priorityDistribution.high;
        document.getElementById('medium-priority').textContent = stats.priorityDistribution.medium;
        document.getElementById('low-priority').textContent = stats.priorityDistribution.low;
        document.getElementById('due-today').textContent = stats.dueToday;
        document.getElementById('overdue').textContent = stats.overdue;

        // Update chart bars
        const maxTasks = Math.max(
            stats.priorityDistribution.high,
            stats.priorityDistribution.medium,
            stats.priorityDistribution.low
        );

        updateChartBar('high', stats.priorityDistribution.high, maxTasks);
        updateChartBar('medium', stats.priorityDistribution.medium, maxTasks);
        updateChartBar('low', stats.priorityDistribution.low, maxTasks);

    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

function updateChartBar(priority, value, maxValue) {
    const bar = document.querySelector(`.chart-bar.${priority}`);
    const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
    bar.style.height = `${Math.max(height, 10)}%`; // Minimum height of 10%
    bar.querySelector('.chart-value').textContent = value;
}

function calculateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate completed tasks
    const completedTasks = tasks.filter(task => task.completed === true).length;
    console.log('Completed tasks:', completedTasks); // Add this line to debug

    return {
        totalTasks: tasks.length,
        completedTasks: completedTasks,
        completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
        priorityDistribution: {
            high: tasks.filter(task => task.priority === 'high').length,
            medium: tasks.filter(task => task.priority === 'medium').length,
            low: tasks.filter(task => task.priority === 'low').length
        },
        dueToday: tasks.filter(task => {
            if (!task.dueDate || task.completed) return false;
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === today.getTime();
        }).length,
        overdue: tasks.filter(task => {
            if (!task.dueDate || task.completed) return false;
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate < today;
        }).length
    };
}


// Export/Import Functions
function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'tasks.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Task Manager Report', 20, 20);
    
    // Add date
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    
    // Add stats
    const stats = calculateStats();
    doc.text(`Total Tasks: ${stats.totalTasks}`, 20, 45);
    doc.text(`Completed Tasks: ${stats.completedTasks}`, 20, 55);
    doc.text(`Completion Rate: ${stats.completionRate}%`, 20, 65);
    
    // Add tasks
    let yPos = 85;
    doc.setFontSize(16);
    doc.text('Tasks List:', 20, yPos);
    
    tasks.forEach((task, index) => {
        yPos += 10;
        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(12);
        const status = task.completed ? '[✓]' : '[ ]';
        const dueDate = task.dueDate ? ` (Due: ${new Date(task.dueDate).toLocaleDateString()})` : '';
        doc.text(`${status} ${task.description}${dueDate}`, 20, yPos);
    });
    
    // Save PDF
    doc.save('tasks-report.pdf');
}

function importTasks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const importedTasks = JSON.parse(event.target.result);
                tasks = importedTasks;
                saveTasksToStorage();
                updateUI();
            } catch (err) {
                alert('Error importing tasks. Please check the file format.');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Notification System
class NotificationSystem {
    constructor() {
        this.init();
    }

    init() {
        const notificationBtn = document.querySelector('.notification-btn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => this.checkTasks());
        }
    }

    checkTasks() {
        const now = new Date();
        const dueTasks = [];
        const overdueTasks = [];
        const upcomingTasks = [];

        tasks.forEach(task => {
            if (!task.completed && task.dueDate) {
                const dueDate = new Date(task.dueDate);
                if (this.isToday(dueDate)) {
                    dueTasks.push(task);
                } else if (dueDate < now) {
                    overdueTasks.push(task);
                } else if (this.isWithinNextWeek(dueDate)) {
                    upcomingTasks.push(task);
                }
            }
        });

        this.showTaskSummary(dueTasks, overdueTasks, upcomingTasks);
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    isWithinNextWeek(date) {
        const now = new Date();
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return date > now && date <= weekFromNow;
    }

    showTaskSummary(dueTasks, overdueTasks, upcomingTasks) {
        const modalHTML = `
            <div class="notification-modal">
                <div class="notification-content">
                    <h3>Task Summary</h3>
                    
                    <div class="notification-section">
                        <h4>
                            <i class="fas fa-calendar-day"></i>
                            Due Today (${dueTasks.length})
                        </h4>
                        ${this.createTaskList(dueTasks)}
                    </div>
                    
                    <div class="notification-section">
                        <h4>
                            <i class="fas fa-exclamation-circle"></i>
                            Overdue (${overdueTasks.length})
                        </h4>
                        ${this.createTaskList(overdueTasks)}
                    </div>

                    <div class="notification-section">
                        <h4>
                            <i class="fas fa-calendar-week"></i>
                            Upcoming Week (${upcomingTasks.length})
                        </h4>
                        ${this.createTaskList(upcomingTasks)}
                    </div>
                    
                    <button class="close-notification">
                        <i class="fas fa-times"></i>
                        Close
                    </button>
                </div>
            </div>
        `;

        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHTML;
        document.body.appendChild(modalElement);

        // Add event listener to close button
        modalElement.querySelector('.close-notification').addEventListener('click', () => {
            modalElement.remove();
        });

        // Close on outside click
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) {
                modalElement.remove();
            }
        });
    }

    createTaskList(tasks) {
        if (tasks.length === 0) {
            return '<p class="no-tasks">No tasks</p>';
        }

        // Sort tasks by due date
        const sortedTasks = [...tasks].sort((a, b) => 
            new Date(a.dueDate) - new Date(b.dueDate)
        );

        return `
            <ul class="notification-task-list">
                ${sortedTasks.map(task => `
                    <li class="notification-task-item priority-${task.priority}">
                        <div class="task-info">
                            <span class="priority-dot"></span>
                            <span class="task-description">${task.description}</span>
                        </div>
                        <span class="task-due-date">
                            <i class="fas fa-calendar-alt"></i>
                            ${new Date(task.dueDate).toLocaleDateString()}
                        </span>
                    </li>
                `).join('')}
            </ul>
        `;
    }
}

// Helper Functions
function generateTaskId() {
    return Date.now().toString();
}

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
}

// Task Template Function
function createTaskElement(task) {
    const template = document.getElementById('task-item-template');
    const taskElement = template.content.cloneNode(true).querySelector('.task-item');
    
    taskElement.setAttribute('data-task-id', task.id);
    taskElement.classList.toggle('completed', task.completed);
    
    const priorityIndicator = taskElement.querySelector('.task-priority-indicator');
    priorityIndicator.classList.add(`priority-${task.priority}`);
    
    const description = taskElement.querySelector('.task-description');
    description.textContent = task.description;
    
    const dueDate = taskElement.querySelector('.task-due-date span');
    dueDate.textContent = formatDate(task.dueDate);
    
    // Setup action buttons
    const completeBtn = taskElement.querySelector('.btn-complete');
    completeBtn.addEventListener('click', () => toggleTaskComplete(task.id));
    
    const deleteBtn = taskElement.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => deleteTask(task.id));
    
    return taskElement;
}

// Toggle completed section
function toggleCompletedSection() {
    const wrapper = document.getElementById('completed-wrapper');
    const button = document.getElementById('toggle-completed');
    
    wrapper.classList.toggle('collapsed');
    button.querySelector('i').classList.toggle('fa-chevron-down');
    button.querySelector('i').classList.toggle('fa-chevron-up');
}