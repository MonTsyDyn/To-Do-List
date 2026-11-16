'use strict';

const storageKey = 'todo-board-v1';
const board = document.querySelector('.board');
const columns = [...board.querySelectorAll('.column')];
const statuses = columns.map(column => column.dataset.status);
const template = document.querySelector('#task');
const composer = document.querySelector('#composer');
const titleInput = document.querySelector('#task-title');
const newTask = document.querySelector('.new-task');
const progress = document.querySelector('#progress');
const total = document.querySelector('#total');
const storageNote = document.querySelector('#storage-note');
const toast = document.querySelector('.toast');
const undo = toast.querySelector('.undo');
const messages = {
  todo: 'Задача перенесена в «К выполнению»',
  doing: 'Задача теперь в работе',
  done: 'Задача выполнена',
};
let tasks = [];
let previous;
let toastTimer;
let openCard;
let dragged;
let dropTarget;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(saved)) throw new Error('Invalid tasks');
    const ids = new Set();
    tasks = saved.filter(task => {
      if (!task || typeof task.id !== 'string' || ids.has(task.id) ||
          typeof task.title !== 'string' || !task.title.trim() || !statuses.includes(task.status)) return false;
      ids.add(task.id);
      return true;
    });
    storageNote.textContent = 'Изменения сохраняются автоматически в этом браузере.';
  } catch {
    storageNote.textContent = 'Не удалось загрузить сохранённые задачи.';
  }
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
    storageNote.textContent = 'Изменения сохраняются автоматически в этом браузере.';
    return true;
  } catch {
    storageNote.textContent = 'Браузер не сохранил изменения. Они могут пропасть при перезагрузке.';
    return false;
  }
}

function render() {
  openCard = undefined;
  for (const column of columns) {
    const status = column.dataset.status;
    const list = tasks.filter(task => task.status === status);
    const cards = list.map(task => {
      const card = template.content.firstElementChild.cloneNode(true);
      card.dataset.id = task.id;
      card.querySelector('.task-title').textContent = task.title;
      const checkbox = card.querySelector('input');
      checkbox.checked = status === 'done';
      checkbox.setAttribute('aria-label', 'Выполнена: ' + task.title);
      card.querySelector('.options').setAttribute('aria-label', 'Действия: ' + task.title);
      card.querySelector('[data-move="' + status + '"]').hidden = true;
      return card;
    });
    column.querySelector('.cards').replaceChildren(...cards);
    column.querySelector('.count').textContent = list.length;
    column.querySelector('.empty').hidden = list.length > 0 ||
      (status === 'todo' && !composer.hidden);
  }
  const completed = tasks.filter(task => task.status === 'done').length;
  progress.max = tasks.length || 1;
  progress.value = completed;
  total.textContent = completed + ' из ' + tasks.length + ' задач';
}

function update(next, message) {
  previous = tasks;
  tasks = next;
  const saved = save();
  render();
  toast.hidden = false;
  toast.querySelector('[role="status"]').textContent = saved ? message : 'Изменения не удалось сохранить';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 7000);
}

function focusCard(id, selector) {
  [...board.querySelectorAll('.card')].find(card => card.dataset.id === id)?.querySelector(selector)?.focus();
}

function move(id, status, anchor, after = false) {
  const source = tasks.find(task => task.id === id);
  if (!source || anchor?.dataset.id === id) return;
  const next = tasks.filter(task => task !== source);
  const anchorIndex = anchor ? next.findIndex(task => task.id === anchor.dataset.id) : -1;
  next.splice(anchorIndex < 0 ? next.length : anchorIndex + Number(after), 0, { ...source, status });
  if (source.status === status && next.every((task, index) => task.id === tasks[index].id)) return;
  update(next, source.status === status ? 'Порядок задач изменён' : messages[status]);
}

function showComposer(show) {
  composer.hidden = !show;
  newTask.setAttribute('aria-expanded', String(show));
  columns[0].querySelector('.empty').hidden = show || tasks.some(task => task.status === 'todo');
  if (show) {
    titleInput.focus();
  } else {
    composer.reset();
    titleInput.setCustomValidity('');
    newTask.focus();
  }
}

newTask.addEventListener('click', () => showComposer(true));
composer.querySelectorAll('.cancel').forEach(button => {
  button.addEventListener('click', () => showComposer(false));
});
titleInput.addEventListener('input', () => titleInput.setCustomValidity(''));
composer.addEventListener('submit', event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.setCustomValidity('Введите название задачи.');
    titleInput.reportValidity();
    return;
  }
  const id = crypto.randomUUID();
  showComposer(false);
  update([{ id, title, status: 'todo' }, ...tasks], 'Задача добавлена');
});

undo.addEventListener('click', () => {
  if (!previous) return;
  tasks = previous;
  previous = undefined;
  save();
  render();
  toast.hidden = true;
  newTask.focus();
});

function closeMenu() {
  if (!openCard) return;
  openCard.querySelector('.options').setAttribute('aria-expanded', 'false');
  openCard.querySelector('.card-menu').hidden = true;
  openCard = undefined;
}

document.addEventListener('click', event => {
  if (openCard && !openCard.contains(event.target)) closeMenu();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (openCard) {
    openCard.querySelector('.options').focus();
    closeMenu();
  } else if (!composer.hidden) {
    showComposer(false);
  }
});

board.addEventListener('click', event => {
  const button = event.target.closest('button');
  const card = button?.closest('.card');
  if (!card) return;
  const id = card.dataset.id;
  if (button.matches('.options')) {
    const alreadyOpen = openCard === card;
    closeMenu();
    if (!alreadyOpen) {
      openCard = card;
      button.setAttribute('aria-expanded', 'true');
      card.querySelector('.card-menu').hidden = false;
    }
  } else if (button.dataset.move) {
    move(id, button.dataset.move);
    focusCard(id, '.options');
  } else if (button.matches('.delete')) {
    update(tasks.filter(task => task.id !== id), 'Задача удалена');
    undo.focus();
  }
});

board.addEventListener('change', event => {
  if (!event.target.matches('.check input')) return;
  const id = event.target.closest('.card').dataset.id;
  move(id, event.target.checked ? 'done' : 'todo');
  focusCard(id, 'input');
});

function clearTarget() {
  dropTarget?.column.classList.remove('is-target');
  dropTarget?.anchor?.classList.remove('insert-before', 'insert-after');
  dropTarget = undefined;
}

board.addEventListener('dragstart', event => {
  dragged = event.target.closest('.card');
  if (!dragged) return;
  closeMenu();
  event.dataTransfer.setData('text/plain', dragged.dataset.id);
  event.dataTransfer.effectAllowed = 'move';
  dragged.classList.add('dragging');
});

board.addEventListener('dragover', event => {
  if (!dragged) return;
  const column = event.target.closest('.column');
  clearTarget();
  if (!column) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const anchor = event.target.closest('.card');
  const box = anchor?.getBoundingClientRect();
  const after = box ? event.clientY >= box.top + box.height / 2 : false;
  dropTarget = { column, anchor, after };
  column.classList.add('is-target');
  if (anchor !== dragged) anchor?.classList.add(after ? 'insert-after' : 'insert-before');
});

board.addEventListener('dragleave', event => {
  if (!dropTarget?.column.contains(event.relatedTarget)) clearTarget();
});

board.addEventListener('drop', event => {
  if (!dragged || !dropTarget) return;
  event.preventDefault();
  const { column, anchor, after } = dropTarget;
  const id = dragged.dataset.id;
  clearTarget();
  dragged.classList.remove('dragging');
  dragged = undefined;
  move(id, column.dataset.status, anchor, after);
});

board.addEventListener('dragend', () => {
  clearTarget();
  dragged?.classList.remove('dragging');
  dragged = undefined;
});

window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  previous = undefined;
  toast.hidden = true;
  load();
  render();
});

load();
render();
