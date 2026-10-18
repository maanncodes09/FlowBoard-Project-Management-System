
"use strict";

// ==========================================
// 1. APPLICATION STATE
// ==========================================

const state = {
    tasks: []
};

const STATUSES = ["todo", "in-progress", "done"];
const STORAGE_KEY = "flowboard-app-data";

const history = {
    past: [],
    future: []
};

const MAX_HISTORY = 50;


let editingTaskId = null;
let draggedTaskId = null;

const STATUS_LABELS = {
    todo: "To Do",
    "in-progress": "In Progress",
    done: "Done"
};
const TASK_LABELS = {
    frontend: "Frontend",
    backend: "Backend",
    bug: "Bug",
    feature: "Feature",
    documentation: "Documentation"
};

// ==========================================
// 2. DOM REFERENCES
// ==========================================

const board = document.querySelector(".board");

const addTaskButton = document.querySelector("#add-task-btn");
const taskDialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");

const taskTitleInput = document.querySelector("#task-title");
const taskDescriptionInput = document.querySelector("#task-description");
const taskPriorityInput = document.querySelector("#task-priority");

const taskCountElement = document.querySelector("#task-count");
const dialogTitle = document.querySelector("#dialog-title");
const submitTaskButton = document.querySelector("#submit-task-btn");

const undoButton = document.querySelector("#undo-btn");
const redoButton = document.querySelector("#redo-btn");

const taskSearchInput = document.querySelector("#task-search");
const statusFilter = document.querySelector("#status-filter");
const priorityFilter = document.querySelector("#priority-filter");
const sortTasksSelect = document.querySelector("#sort-tasks");
const resetFiltersButton = document.querySelector("#reset-filters-btn");
const taskDueDateInput = document.querySelector("#task-due-date");
const labelFilterInputs = document.querySelectorAll(
    'input[name="label-filter"]'
);



// ==========================================
// 3. TASK MODEL
// ==========================================



function createTask({
    title,
    description,
    priority,
    dueDate = "",
    labels = []
}) {
    return {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate,
        labels: labels.filter(label =>
            Object.hasOwn(TASK_LABELS, label)
        ),
        status: "todo",
        createdAt: new Date().toISOString()
    };
}



// ==========================================
// 4. FIND A TASK
// ==========================================

function findTaskById(taskId) {
    return state.tasks.find(task => task.id === taskId);
}

function cloneTasks() {
    return structuredClone(state.tasks);
}

function recordHistory() {
    history.past.push(cloneTasks());

    if (history.past.length > MAX_HISTORY) {
        history.past.shift();
    }

    // A new action creates a new timeline.
    history.future = [];
    updateHistoryButtons();
}

function updateHistoryButtons() {
    undoButton.disabled = history.past.length === 0;
    redoButton.disabled = history.future.length === 0;
}

function undo() {
    if (history.past.length === 0) return;

    history.future.push(cloneTasks());
    state.tasks = history.past.pop();

    renderBoard();
    updateHistoryButtons();
}

function redo() {
    if (history.future.length === 0) return;

    history.past.push(cloneTasks());

    if (history.past.length > MAX_HISTORY) {
        history.past.shift();
    }

    state.tasks = history.future.pop();

    renderBoard();
    updateHistoryButtons();
}


function isValidTask(task) {
    return (
        task !== null &&
        typeof task === "object" &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.description === "string" &&
        ["high", "medium", "low"].includes(task.priority) &&
        STATUSES.includes(task.status) &&
        typeof task.createdAt === "string" &&
        (
            task.dueDate === undefined ||
            typeof task.dueDate === "string"
        ) &&
        (
            task.labels === undefined ||
            (
                Array.isArray(task.labels) &&
                task.labels.every(label =>
                    Object.hasOwn(TASK_LABELS, label)
                )
            )
        )
    );
}


function isValidTaskList(tasks) {
    return (
        Array.isArray(tasks) &&
        tasks.every(isValidTask)
    );
}

function saveAppData() {
    try {
        const appData = {
            tasks: state.tasks,
            past: history.past,
            future: history.future
        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(appData)
        );
    } catch (error) {
        console.error("FlowBoard could not save its data:", error);
    }
}

function loadAppData() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        // No saved data exists yet.
        if (savedData === null) {
            return;
        }

        const appData = JSON.parse(savedData);

        if (
            appData === null ||
            typeof appData !== "object" ||
            !isValidTaskList(appData.tasks)
        ) {
            console.warn("FlowBoard saved data is invalid.");
            return;
        }

        state.tasks = appData.tasks;

        // Restore valid undo history snapshots.
        history.past = Array.isArray(appData.past)
            ? appData.past.filter(isValidTaskList).slice(-MAX_HISTORY)
            : [];

        // Restore valid redo history snapshots.
        history.future = Array.isArray(appData.future)
            ? appData.future.filter(isValidTaskList).slice(-MAX_HISTORY)
            : [];

        updateHistoryButtons();
    } catch (error) {
        console.error("FlowBoard could not load its data:", error);
    }
}




// ==========================================
// 5. CREATE A TASK
// ==========================================

function addTask(taskData) {
    recordHistory();

    const task = createTask(taskData);
    state.tasks.push(task);
    renderBoard();
    return task;
}

// ==========================================
// 6. EDIT A TASK
// ==========================================

function editTask(taskId, updatedData) {
    const task = findTaskById(taskId);

    if (!task) {
        return false;
    }
    recordHistory();

    task.title = updatedData.title.trim();
    task.description = updatedData.description.trim();
    task.priority = updatedData.priority;
    task.dueDate = updatedData.dueDate || "";
    task.labels = Array.isArray(updatedData.labels)
    ? updatedData.labels.filter(label =>
        Object.hasOwn(TASK_LABELS, label)
    )
    : [];

    renderBoard();

    return true;
}

function openEditDialog(taskId) {
    const task = findTaskById(taskId);

    if (!task) {
        return;
    }

    editingTaskId = taskId;

    dialogTitle.textContent = "Edit task";
    submitTaskButton.textContent = "Save Changes";

    taskTitleInput.value = task.title;
    taskDescriptionInput.value = task.description;
    taskPriorityInput.value = task.priority;
    taskDueDateInput.value = task.dueDate || "";
    taskForm
    .querySelectorAll('input[name="task-label"]')
    .forEach(input => {
        input.checked = (task.labels || []).includes(input.value);
    });

    taskDialog.showModal();
    taskTitleInput.focus();
}

// ==========================================
// 7. DELETE A TASK
// ==========================================

function deleteTask(taskId) {
    const task = findTaskById(taskId);
    if (!task) return;

    recordHistory();

    state.tasks = state.tasks.filter(
        task => task.id !== taskId
    );

    renderBoard();
}

// ==========================================
// 8. MOVE A TASK BETWEEN COLUMNS
// ==========================================

function moveTask(taskId, newStatus) {
    if (!STATUSES.includes(newStatus)) {
        return;
    }

    const task = findTaskById(taskId);

    if (!task || task.status === newStatus) {
        return;
    }
    recordHistory();

    task.status = newStatus;

    renderBoard();
}

// ==========================================
// 9. REORDER A TASK
// ==========================================


function reorderTask(
    taskId,
    newStatus,
    targetTaskId = null,
    insertAfter = false
) {
    if (!STATUSES.includes(newStatus)) {
        return;
    }

    const task = findTaskById(taskId);

    if (!task || taskId === targetTaskId) {
        return;
    }

    // Remove the dragged task from its current position.
    const originalIndex = state.tasks.findIndex(
        item => item.id === taskId
    );

    if (originalIndex === -1) {
        return;
    }
    recordHistory();

    state.tasks.splice(originalIndex, 1);

    // Update the destination column.
    task.status = newStatus;

    if (targetTaskId) {
        const targetIndex = state.tasks.findIndex(
            item => item.id === targetTaskId
        );

        if (targetIndex !== -1) {
            // Insert before or after the target card.
            const insertionIndex =
                targetIndex + (insertAfter ? 1 : 0);

            state.tasks.splice(insertionIndex, 0, task);
        } else {
            state.tasks.push(task);
        }
    } else {
        // Append to the end of the destination column.
        const lastIndex = state.tasks.reduce(
            (last, item, index) =>
                item.status === newStatus ? index : last,
            -1
        );

        state.tasks.splice(lastIndex + 1, 0, task);
    }

    renderBoard();


}

function getDueDateDetails(task) {
    if (!task.dueDate) return null;

    const [year, month, day] = task.dueDate.split("-").map(Number);

    // Construct a local date to avoid UTC date-shift issues.
    const dueDate = new Date(year, month - 1, day);

    const formattedDate = dueDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

    // Completed tasks should not be flagged as overdue.
    if (task.status === "done") {
        return {
            label: `Due ${formattedDate}`,
            className: "due-date due-completed"
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.round(
        (dueDate.getTime() - today.getTime()) / 86400000
    );

    if (daysUntilDue < 0) {
        return {
            label: `Overdue · ${formattedDate}`,
            className: "due-date overdue"
        };
    }

    if (daysUntilDue === 0) {
        return {
            label: `Due today · ${formattedDate}`,
            className: "due-date due-today"
        };
    }

    if (daysUntilDue <= 3) {
        return {
            label: `Due soon · ${formattedDate}`,
            className: "due-date due-soon"
        };
    }

    return {
        label: `Due ${formattedDate}`,
        className: "due-date"
    };
}



// ==========================================
// 10. CREATE A TASK CARD
// ==========================================

function createTaskCard(task) {
    const card = document.createElement("article");

    card.className = "task-card";
    card.dataset.taskId = task.id;
    card.draggable = true;

    const title = document.createElement("h4");
    title.textContent = task.title;

    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent =
        task.description || "No description provided.";

    const meta = document.createElement("div");
    meta.className = "task-meta";
    
const dueDateInfo = getDueDateDetails(task);

let dueDateElement = null;

if (dueDateInfo) {
    dueDateElement = document.createElement("p");
    dueDateElement.className = dueDateInfo.className;
    dueDateElement.textContent = dueDateInfo.label;
}


    const priority = document.createElement("span");
    priority.className = `priority priority-${task.priority}`;
    priority.textContent = task.priority;

    const status = document.createElement("span");
    status.className = "muted";
    status.textContent = STATUS_LABELS[task.status];

    meta.append(priority, status);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const currentIndex = STATUSES.indexOf(task.status);

    if (currentIndex > 0) {
        actions.append(
            createActionButton("previous", "← Previous")
        );
    }

    if (currentIndex < STATUSES.length - 1) {
        actions.append(
            createActionButton("next", "Next →")
        );
    }

    actions.append(
        createActionButton("edit", "Edit"),
        createActionButton("delete", "Delete", "delete-task-btn")
    );
    
const labelsContainer = document.createElement("div");
labelsContainer.className = "task-labels";

for (const label of task.labels || []) {
    const labelName = TASK_LABELS[label];

    // Ignore unknown labels in old or invalid saved data.
    if (!labelName) continue;

    const labelElement = document.createElement("span");
    labelElement.className = `task-label label-${label}`;
    labelElement.textContent = labelName;

    labelsContainer.append(labelElement);
}


card.append(title, description, meta);

if (dueDateElement) {
    card.append(dueDateElement);
}
if (labelsContainer.children.length > 0) {
    card.append(labelsContainer);
}

card.append(actions);
    return card;
}

function createActionButton(action, label, className = "") {
    const button = document.createElement("button");

    button.type = "button";
    button.dataset.action = action;
    button.textContent = label;

    if (className) {
        button.className = className;
    }

    return button;
}

function hasActiveViewOptions() {
    return (
        taskSearchInput.value.trim() !== "" ||
        statusFilter.value !== "all" ||
        priorityFilter.value !== "all" ||
        sortTasksSelect.value !== "default" ||
        [...labelFilterInputs].some(input => input.checked)
    );
}

function getVisibleTasks() {
    const searchTerm = taskSearchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const selectedPriority = priorityFilter.value;
    const sortBy = sortTasksSelect.value;

    // Start with a copy so we never mutate the original task array.
    let visibleTasks = [...state.tasks];

    // 1. Search by title or description.
    if (searchTerm) {
        visibleTasks = visibleTasks.filter(task =>
            task.title.toLowerCase().includes(searchTerm) ||
            task.description.toLowerCase().includes(searchTerm)
        );
    }

    // 2. Filter by status.
    if (selectedStatus !== "all") {
        visibleTasks = visibleTasks.filter(
            task => task.status === selectedStatus
        );
    }

    // 3. Filter by priority.
    if (selectedPriority !== "all") {
        visibleTasks = visibleTasks.filter(
            task => task.priority === selectedPriority
        );
    }
    const selectedLabels = [...labelFilterInputs]
    .filter(input => input.checked)
    .map(input => input.value);

if (selectedLabels.length > 0) {
    visibleTasks = visibleTasks.filter(task =>
        selectedLabels.some(label =>
            (task.labels || []).includes(label)
        )
    );
}

    // 4. Sort the resulting copy.
    switch (sortBy) {
        case "title-asc":
            visibleTasks.sort((a, b) =>
                a.title.localeCompare(b.title)
            );
            break;

        case "title-desc":
            visibleTasks.sort((a, b) =>
                b.title.localeCompare(a.title)
            );
            break;

        case "newest":
            visibleTasks.sort((a, b) =>
                b.createdAt.localeCompare(a.createdAt)
            );
            break;

        case "oldest":
            visibleTasks.sort((a, b) =>
                a.createdAt.localeCompare(b.createdAt)
            );
            break;

        case "priority": {
            const priorityRank = {
                high: 1,
                medium: 2,
                low: 3
            };

            visibleTasks.sort((a, b) =>
                priorityRank[a.priority] - priorityRank[b.priority]
            );
            break;
        }
    }

    return visibleTasks;
}

function resetFilters() {
    taskSearchInput.value = "";
    statusFilter.value = "all";
    priorityFilter.value = "all";
    sortTasksSelect.value = "default";
    labelFilterInputs.forEach(input => {
    input.checked = false;
});

    renderBoard();
}

taskSearchInput.addEventListener("input", renderBoard);

statusFilter.addEventListener("change", renderBoard);

priorityFilter.addEventListener("change", renderBoard);

sortTasksSelect.addEventListener("change", renderBoard);

resetFiltersButton.addEventListener("click", resetFilters);
labelFilterInputs.forEach(input => {
    input.addEventListener("change", renderBoard);
});

// ==========================================
// 11. RENDER THE BOARD
// ==========================================


function renderBoard() {
    const visibleTasks = getVisibleTasks();

    const fragments = {
        todo: document.createDocumentFragment(),
        "in-progress": document.createDocumentFragment(),
        done: document.createDocumentFragment()
    };

    for (const task of visibleTasks) {
        const card = createTaskCard(task);

        // Prevent confusing drag-and-drop behavior when the view
        // is filtered or sorted.
        card.draggable = !hasActiveViewOptions();

        fragments[task.status].append(card);
    }

    for (const status of STATUSES) {
        const list = document.querySelector(`#${status}-list`);

        list.replaceChildren(fragments[status]);

        const visibleCount = visibleTasks.filter(
            task => task.status === status
        ).length;

        if (visibleCount === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "empty-state";

            const tasksExistInColumn = state.tasks.some(
                task => task.status === status
            );

            emptyMessage.textContent = tasksExistInColumn
                ? "No matching tasks"
                : "No tasks yet";

            list.append(emptyMessage);
        }

        const column = list.closest(".board-column");

        column.querySelector(".column-count").textContent =
            visibleCount;
    }

    // This remains the total number of tasks, not the filtered count.
    taskCountElement.textContent = state.tasks.length;

    saveAppData();
}


// ==========================================
// 12. DIALOG CONTROLS
// ==========================================

function openCreateDialog() {
    editingTaskId = null;

    taskForm.reset();

    dialogTitle.textContent = "Create a task";
    submitTaskButton.textContent = "Create Task";

    taskDialog.showModal();
    taskTitleInput.focus();
}

function closeTaskDialog() {
    taskDialog.close();

    editingTaskId = null;
    taskForm.reset();

    dialogTitle.textContent = "Create a task";
    submitTaskButton.textContent = "Create Task";
}

addTaskButton.addEventListener("click", openCreateDialog);

document.querySelector("#cancel-task-btn")
    .addEventListener("click", closeTaskDialog);

document.querySelector("#close-dialog-btn")
    .addEventListener("click", closeTaskDialog);
    
undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

document.addEventListener("keydown", event => {
    const target = event.target;

    // Let text fields handle their own undo behavior.
    const isTyping =
        target instanceof HTMLElement &&
        (
            target.matches("input, textarea, select") ||
            target.isContentEditable
        );

    if (isTyping) return;

    const modifierPressed = event.ctrlKey || event.metaKey;

    if (!modifierPressed || event.altKey) return;

    // Ctrl+Z / Cmd+Z = Undo
    if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
    }

    // Ctrl+Y / Cmd+Shift+Z = Redo
    if (
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey)
    ) {
        event.preventDefault();
        redo();
    }
});


// ==========================================
// 13. HANDLE FORM SUBMISSION
// ==========================================

taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const taskData = {
    title: taskTitleInput.value.trim(),
    description: taskDescriptionInput.value,
    priority: taskPriorityInput.value,
    dueDate: taskDueDateInput.value,

    labels: [
        ...taskForm.querySelectorAll(
            'input[name="task-label"]:checked'
        )
    ].map(input => input.value)
};
    if (!taskData.title) {
        taskTitleInput.focus();
        return;
    }

    if (editingTaskId) {
        editTask(editingTaskId, taskData);
    } else {
        addTask(taskData);
    }

    closeTaskDialog();
});

// ==========================================
// 14. EVENT DELEGATION FOR CARD BUTTONS
// ==========================================

board.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button || !board.contains(button)) {
        return;
    }

    const card = button.closest("[data-task-id]");

    if (!card) {
        return;
    }

    const taskId = card.dataset.taskId;
    const action = button.dataset.action;

    if (action === "delete") {
        deleteTask(taskId);
        return;
    }

    if (action === "edit") {
        openEditDialog(taskId);
        return;
    }

    const task = findTaskById(taskId);

    if (!task) {
        return;
    }

    const currentIndex = STATUSES.indexOf(task.status);

    if (action === "next" && currentIndex < STATUSES.length - 1) {
        moveTask(taskId, STATUSES[currentIndex + 1]);
    }

    if (action === "previous" && currentIndex > 0) {
        moveTask(taskId, STATUSES[currentIndex - 1]);
    }
});

// ==========================================
// 15. DRAG START
// ==========================================

board.addEventListener("dragstart", event => {
    const card = event.target.closest(".task-card");

    if (!card) {
        return;
    }

    draggedTaskId = card.dataset.taskId;

    event.dataTransfer.setData("text/plain", draggedTaskId);
    event.dataTransfer.effectAllowed = "move";

    card.classList.add("dragging");
});

// ==========================================
// 16. DRAG END
// ==========================================

board.addEventListener("dragend", () => {
    draggedTaskId = null;

    document.querySelectorAll(".dragging, .drop-target")
        .forEach(element => {
            element.classList.remove("dragging", "drop-target");
        });

    document.querySelectorAll(".task-list.drag-over")
        .forEach(list => list.classList.remove("drag-over"));
});

// ==========================================
// 17. ALLOW DROP
// ==========================================

board.addEventListener("dragover", event => {
    const list = event.target.closest(".task-list");

    if (!list || !draggedTaskId) {
        return;
    }

    event.preventDefault();

    event.dataTransfer.dropEffect = "move";

    document.querySelectorAll(".task-list.drag-over")
        .forEach(item => {
            if (item !== list) {
                item.classList.remove("drag-over");
            }
        });

    list.classList.add("drag-over");

    const targetCard = event.target.closest(".task-card");

    document.querySelectorAll(".task-card.drop-target")
        .forEach(card => {
            if (card !== targetCard) {
                card.classList.remove("drop-target");
            }
        });

    if (targetCard && targetCard.dataset.taskId !== draggedTaskId) {
        targetCard.classList.add("drop-target");
    }
});

// ==========================================
// 18. HANDLE DROP
// ==========================================


board.addEventListener("drop", event => {
    const list = event.target.closest(".task-list");

    if (!list || !draggedTaskId) {
        return;
    }

    event.preventDefault();

    const draggedId =
        event.dataTransfer.getData("text/plain") || draggedTaskId;

    const targetCard = event.target.closest(".task-card");

    const targetTaskId = targetCard
        ? targetCard.dataset.taskId
        : null;

    // Determine whether the pointer is above or below
    // the midpoint of the target card.
    let insertAfter = false;

    if (targetCard && targetTaskId !== draggedId) {
        const rect = targetCard.getBoundingClientRect();

        insertAfter = event.clientY > rect.top + rect.height / 2;
    }

    const destinationColumn = list.closest(".board-column");
    const destinationStatus = destinationColumn.dataset.status;

    reorderTask(
        draggedId,
        destinationStatus,
        targetTaskId,
        insertAfter
    );
});

// ==========================================
// 19. INITIALIZE
// ==========================================
loadAppData();
renderBoard();
updateHistoryButtons();

console.log("FlowBoard initialized successfully.");