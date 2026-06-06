let currentYear = new Date().getFullYear();
let lastLoadedCss = null;
let bypassLock = false;
let currentModule = null;

async function loadYear(year) {
    updateBirthdayCountdown();

    const container = document.getElementById("yearContainer");
    const lockScreen = document.getElementById('birthdayLock');
    const tempDiv = document.createElement("div");

    // 1. Fetch HTML into memory first (keeps the DOM stable during network transit)
    try {
        const response = await fetch(`html/${year}.html`);
        if (!response.ok) throw new Error(`Failed to load html/${year}.html`);
        tempDiv.innerHTML = await response.text();
    } catch (err) {
        console.error(err);
        container.innerHTML = `<p>Unable to load year ${year}</p>`;
        if (lockScreen) hideContainer(lockScreen);
        showContainer(container, true);
        return;
    }

    // 2. Clear old module loops and import the new year bundle
    try {
        if (currentModule && typeof currentModule.destroy === 'function') {
            currentModule.destroy();
        }
        currentModule = await import(`./${year}.js?t=${Date.now()}`);
    } catch (err) {
        console.error(err);
        container.innerHTML = `<p>Unable to load JS for ${year}</p>`;
        if (lockScreen) hideContainer(lockScreen);
        showContainer(container, true);
        return;
    }

    // 3. Remove old CSS from document head
    if (lastLoadedCss) {
        document.head.removeChild(lastLoadedCss);
        lastLoadedCss = null; 
    }

    // 4. Load the new stylesheet explicitly before screen paint
    try {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = `css/${year}.css`;

        await new Promise((resolve, reject) => {
            css.onload = resolve;
            css.onerror = () => reject(new Error(`CSS load failed for ${year}`));
            document.head.appendChild(css);
        });
        
        lastLoadedCss = css;
    } catch (cssErr) {
        console.warn("CSS failed to load, proceeding with structural layout:", cssErr);
    }

    // 5. Inject the clean HTML payload into the DOM tree
    container.innerHTML = tempDiv.innerHTML;

    // 6. Initialize module state logic passing the shared handlers
    if (currentModule?.initialize) {
        currentModule.initialize(shared);
    }

    // 7. THE SMOOTH SWAP: Simultaneously transition visibility states
    if (lockScreen) {
        hideContainer(lockScreen);
    }

	const homeBtn = document.getElementById('global-home-btn');
	if (homeBtn) {
		showContainer(homeBtn);
	}

	const yearNav = document.getElementById('year-navigation');
    if (yearNav) {
        hideContainer(yearNav);
    }

    showContainer(container, true);

	const mainTitle = document.getElementById('main-title');
    if (mainTitle) {
        mainTitle.textContent = `Ryan Higa — ${year}`;
    }

    currentYear = year;
}

function getLatestSupportedYear() {
    const yearButtons = document.querySelectorAll('.year-navigation .link-button');
    let maxYear = 2026; // Base fallback configuration

    yearButtons.forEach(button => {
        const btnYear = parseInt(button.getAttribute('data-year'), 10);
        if (!isNaN(btnYear) && btnYear > maxYear) {
            maxYear = btnYear;
        }
    });

    return maxYear;
}

// Birthday countdown
function updateBirthdayCountdown() {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let birthDate = new Date(now.getFullYear(), 5, 6); // June 6

	if (today > birthDate) {
		birthDate = new Date(now.getFullYear() + 1, 5, 6);
	}

	const diff = birthDate - today;
	const days = Math.round(diff / (1000 * 60 * 60 * 24));

	const birthdayCount = document.getElementById('bigNumber');
	if (birthdayCount) birthdayCount.textContent = days;

	return days;
}

function showContainer(container, isFlex = false) {
    if (!container) return;
    
    container.classList.remove('hidden');
    if (isFlex) {
        container.classList.add('flex');
    } else {
        container.classList.remove('flex'); // Prevents accidental flex/block overlap
    }
}

function hideContainer(container) {
    if (!container) return;
    
    container.classList.add('hidden');
    container.classList.remove('flex'); // Always safely clean up layout classes on hide
}

function showMessage(text) {
	const message = document.getElementById('message');
	message.textContent = text;
	message.classList.add('show');

	message.addEventListener('animationend', () => {
		message.classList.remove('show');
	}, { once: true });
}

const shared = {
	showContainer,
	hideContainer,
	showMessage
};
// Bypass birthday lock
document.getElementById("bypassLock").addEventListener("click", async () => {
    bypassLock = true;
    const latestAvailable = getLatestSupportedYear();
    
    // Safety check: if system clock matches an unbuilt future year, use the highest defined button year instead
    if (currentYear > latestAvailable) {
        await loadYear(latestAvailable);
    } else {
        await loadYear(currentYear);
    }
});

document.querySelectorAll('.year-navigation .link-button').forEach(button => {
    button.addEventListener('click', async (e) => {
        const selectedYear = parseInt(e.target.getAttribute('data-year'), 10);
        bypassLock = true; 
        await loadYear(selectedYear);
    });
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const daysLeft = updateBirthdayCountdown();
        
        if (daysLeft === 0 || bypassLock) {
            // Smoothly fetch and load the game elements behind the scenes
            await loadYear(currentYear);
        } else {
            // It's not birthday time yet; explicitly show the lock screen plate
            const lockScreen = document.getElementById('birthdayLock');
            showContainer(lockScreen, true);
        }
    } catch (err) {
        console.error("Initialization failure:", err);
    }
});

// Inside your main.js file initialization step
document.getElementById('global-home-btn').addEventListener('click', () => {
	const homeBtn = document.getElementById('global-home-btn');
	if (homeBtn) {
		hideContainer(homeBtn);
	}

    // Clear out your year view wrapper injection target completely
    const yearContainer = document.getElementById('yearContainer');
    if (yearContainer) {
        yearContainer.innerHTML = '';
        yearContainer.classList.add('hidden');
    }

    // Restore the countdown landing dashboard
    const birthdayLock = document.getElementById('birthdayLock');
    if (birthdayLock) {
        showContainer(birthdayLock);
    }

	const navigation = document.getElementById('year-navigation');
	if (navigation) {
		showContainer(navigation);
	}
    
    console.log("🏠 Navigated back to the main countdown entry screen.");
});