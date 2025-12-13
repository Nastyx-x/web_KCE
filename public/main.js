const QUESTIONS_URL = "questions.json";
const STORAGE_KEY = "riskuj-game-state";

let gameData = [];
let state = null;
let activeQuestion = null;
let timerInterval = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
    await loadQuestions();
    loadState();
    renderBoard();
    renderTeams();
    renderTimer();
    bindEvents();
    startTimer();
}

/* ================= DATA ================= */

async function loadQuestions() {
    const res = await fetch(QUESTIONS_URL);
    const json = await res.json();

    gameData = json.categories.map((cat, c) => ({
        ...cat,
        questions: cat.questions.map((q, i) => ({
            ...q,
            id: `${c}-${i}`
        }))
    }));
}

/* ================= STATE ================= */

function createInitialState() {
    return {
        usedQuestions: {},
        teams: [
            { id: crypto.randomUUID(), name: "Tým A", score: 0 },
            { id: crypto.randomUUID(), name: "Tým B", score: 0 }
        ],
        activeTeamIndex: 0,
        elapsedSeconds: 0,
        winnerGif: "https://media.tenor.com/jyQAUkmCdVwAAAAC/win-celebration.gif"
    };
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? JSON.parse(saved) : createInitialState();
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ================= TIMER ================= */

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        state.elapsedSeconds++;
        saveState();
        renderTimer();
    }, 1000);
}

function renderTimer() {
    let el = document.getElementById("gameTimer");
    if (!el) {
        el = document.createElement("div");
        el.id = "gameTimer";
        el.style.fontWeight = "700";
        document.querySelector(".top-bar").appendChild(el);
    }
    const m = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, "0");
    const s = String(state.elapsedSeconds % 60).padStart(2, "0");
    el.textContent = `⏱️ ${m}:${s}`;
}

/* ================= BOARD ================= */

function renderBoard() {
    const board = document.getElementById("gameBoard");
    board.innerHTML = "";

    gameData.forEach(cat => {
        const h = document.createElement("div");
        h.className = "category";
        h.textContent = cat.title;
        board.appendChild(h);
    });

    const rows = Math.max(...gameData.map(c => c.questions.length));

    for (let r = 0; r < rows; r++) {
        gameData.forEach(cat => {
            const q = cat.questions[r];
            if (!q) {
                board.appendChild(document.createElement("div"));
                return;
            }

            const cell = document.createElement("div");
            cell.className = "cell";
            if (q.bonus) cell.classList.add("bonus");
            if (state.usedQuestions[q.id]) cell.classList.add("used");

            cell.textContent = q.value;
            cell.onclick = () => openQuestion(cat, q);
            board.appendChild(cell);
        });
    }
}

/* ================= MODAL ================= */

function openQuestion(category, question) {
    if (state.usedQuestions[question.id]) return;
    activeQuestion = { category, question };

    document.getElementById("modalCategory").textContent = category.title;
    document.getElementById("modalQuestion").textContent = question.question;

    const a = document.getElementById("modalAnswer");
    a.textContent = question.answer;
    a.classList.add("hidden");

    resetModalButtons();
    document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal").classList.add("hidden");
    activeQuestion = null;
}

/* ================= ANSWER ================= */

function showAnswer() {
    document.getElementById("modalAnswer").classList.remove("hidden");
}

function answer(correct) {
    const team = state.teams[state.activeTeamIndex];
    const value = activeQuestion.question.value;

    team.score += correct ? value : -value;
    state.usedQuestions[activeQuestion.question.id] = true;
    state.activeTeamIndex = (state.activeTeamIndex + 1) % state.teams.length;

    saveState();
    renderBoard();
    renderTeams();
    closeModal();

    if (isGameFinished()) showWinner();
}

/* ================= END GAME ================= */

function isGameFinished() {
    const total = gameData.reduce((s, c) => s + c.questions.length, 0);
    return Object.keys(state.usedQuestions).length >= total;
}

function showWinner() {
    clearInterval(timerInterval);

    const sorted = [...state.teams].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const draw = sorted.length > 1 && sorted[0].score === sorted[1].score;

    document.getElementById("modalCategory").textContent = "🏆 Konec hry";
    document.getElementById("modalQuestion").textContent = draw
        ? "Hra skončila remízou!"
        : `Vítězem je ${winner.name} (${winner.score} bodů)`;

    document.getElementById("modalAnswer").innerHTML = draw ? "" : `
        <img src="${state.winnerGif}"
             style="max-width:100%;border-radius:12px;margin-top:1rem">
    `;
    document.getElementById("modalAnswer").classList.remove("hidden");

    document.getElementById("showAnswerBtn").classList.add("hidden");
    document.getElementById("correctBtn").classList.add("hidden");
    document.getElementById("wrongBtn").classList.add("hidden");

    document.getElementById("modal").classList.remove("hidden");
}

/* ================= TEAMS ================= */
function toggleTeamMenu(e, el) {
    e.stopPropagation();

    // zavřít všechna ostatní menu
    document.querySelectorAll(".team-menu.open")
        .forEach(m => m.classList.remove("open"));

    el.classList.toggle("open");
}

// klik mimo menu = zavřít
document.addEventListener("click", () => {
    document.querySelectorAll(".team-menu.open")
        .forEach(m => m.classList.remove("open"));
});

function renderTeams() {
    const container = document.getElementById("teams");
    container.innerHTML = "";

    state.teams.forEach((team, index) => {
        const el = document.createElement("div");
        el.className = "team";
        if (index === state.activeTeamIndex) el.classList.add("active");

        el.innerHTML = `
            <span class="active-indicator">${index === state.activeTeamIndex ? "▶" : ""}</span>
            <input value="${team.name}">
            <span class="team-score">${team.score}</span>

          <div class="team-menu" onclick="toggleTeamMenu(event, this)">
                    ⋮
                <div class="team-dropdown">
                    <button onclick="setActiveTeam(${index})">Nastavit aktivní</button>
                    <button class="danger" onclick="removeTeam(${index})">Smazat tým</button>
                </div>
            </div>
        `;

        el.querySelector("input").onchange = e => {
            team.name = e.target.value;
            saveState();
        };

        container.appendChild(el);
    });

    renderRandomStartButton(container);
}

function renderRandomStartButton(container) {
    const btn = document.createElement("button");
    btn.className = "btn secondary";
    btn.textContent = "🎲 Náhodný začínající tým";
    btn.style.width = "100%";
    btn.style.marginTop = "1rem";

    btn.onclick = () => {
        state.activeTeamIndex = Math.floor(Math.random() * state.teams.length);
        saveState();
        renderTeams();
    };

    container.appendChild(btn);
}

window.setActiveTeam = index => {
    state.activeTeamIndex = index;
    saveState();
    renderTeams();
};

window.removeTeam = index => {
    if (state.teams.length <= 1) {
        alert("Musí zůstat alespoň jeden tým.");
        return;
    }
    state.teams.splice(index, 1);
    if (state.activeTeamIndex >= state.teams.length) {
        state.activeTeamIndex = 0;
    }
    saveState();
    renderTeams();
};

/* ================= EVENTS ================= */

function bindEvents() {
    document.getElementById("showAnswerBtn").onclick = showAnswer;
    document.getElementById("correctBtn").onclick = () => answer(true);
    document.getElementById("wrongBtn").onclick = () => answer(false);
    document.getElementById("closeModalBtn").onclick = closeModal;

    document.getElementById("addTeamBtn").onclick = () => {
        state.teams.push({
            id: crypto.randomUUID(),
            name: "Nový tým",
            score: 0
        });
        saveState();
        renderTeams();
    };

    document.getElementById("resetGameBtn").onclick = resetGame;
}

function resetModalButtons() {
    document.getElementById("showAnswerBtn").classList.remove("hidden");
    document.getElementById("correctBtn").classList.remove("hidden");
    document.getElementById("wrongBtn").classList.remove("hidden");
}

function resetGame() {
    document.getElementById("modalCategory").textContent = "Restart hry";
    document.getElementById("modalQuestion").textContent =
        "Opravdu chcete restartovat celou hru?";

    // skrýt věci, které nedávají smysl
    document.getElementById("modalAnswer").classList.add("hidden");
    document.getElementById("showAnswerBtn").classList.add("hidden");

    // ⬇️ TOTO JE DŮLEŽITÉ
    document.getElementById("closeModalBtn").classList.add("hidden");

    const yesBtn = document.getElementById("correctBtn");
    const noBtn = document.getElementById("wrongBtn");

    yesBtn.textContent = "Ano, restart";
    noBtn.textContent = "Zrušit";

    yesBtn.onclick = () => {
        clearInterval(timerInterval);
        state = createInitialState();
        saveState();
        renderBoard();
        renderTeams();
        renderTimer();
        startTimer();
        closeModal();

        // po zavření vrátíme Zavřít zpět
        document.getElementById("closeModalBtn").classList.remove("hidden");
    };

    noBtn.onclick = () => {
        closeModal();
        document.getElementById("closeModalBtn").classList.remove("hidden");
    };

    document.getElementById("modal").classList.remove("hidden");
}

