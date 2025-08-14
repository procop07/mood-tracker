// Mood Tracker - Vanilla JavaScript for Node.js Backend
class MoodTracker {
    constructor() {
        this.selectedMood = null;
        this.apiBaseUrl = window.location.origin;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadMoods();
    }

    bindEvents() {
        // Bind mood button events
        const moodButtons = document.querySelectorAll('.mood-btn');
        moodButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMood(e));
        });

        // Bind save button event
        const saveBtn = document.getElementById('save-mood');
        saveBtn.addEventListener('click', () => this.saveMood());
    }

    selectMood(event) {
        // Remove selected class from all buttons
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Add selected class to clicked button
        event.currentTarget.classList.add('selected');
        this.selectedMood = event.currentTarget.dataset.mood;
    }

    async saveMood() {
        if (!this.selectedMood) {
            this.showMessage('Please select a mood!', 'error');
            return;
        }

        const notes = document.getElementById('notes').value;
        const moodData = {
            mood: this.selectedMood,
            notes: notes,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/moods`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(moodData)
            });

            if (!response.ok) {
                throw new Error('Failed to save mood');
            }

            const result = await response.json();
            this.showMessage('Mood saved successfully!', 'success');
            this.resetForm();
            this.loadMoods(); // Refresh the mood list
        } catch (error) {
            console.error('Error saving mood:', error);
            this.showMessage('Failed to save mood. Please try again.', 'error');
        }
    }

    async loadMoods() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/moods`);
            
            if (!response.ok) {
                throw new Error('Failed to load moods');
            }

            const result = await response.json();
            // For now, we'll use localStorage as fallback since API returns empty array
            const localMoods = JSON.parse(localStorage.getItem('moods')) || [];
            this.displayMoods(localMoods);
        } catch (error) {
            console.error('Error loading moods:', error);
            // Fallback to localStorage
            const localMoods = JSON.parse(localStorage.getItem('moods')) || [];
            this.displayMoods(localMoods);
        }
    }

    displayMoods(moods) {
        const moodList = document.getElementById('mood-list');
        
        if (moods.length === 0) {
            moodList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No mood entries yet. Add your first mood above!</p>';
            return;
        }

        const moodHTML = moods.map(mood => `
            <div class="mood-entry">
                <div class="date">${mood.date} at ${mood.time}</div>
                <div class="mood">${this.getMoodEmoji(mood.mood)} ${this.capitalizeMood(mood.mood)}</div>
                ${mood.notes ? `<div class="notes">"${mood.notes}"</div>` : ''}
            </div>
        `).join('');
        
        moodList.innerHTML = moodHTML;
    }

    getMoodEmoji(mood) {
        const emojis = {
            happy: '😊',
            sad: '😢',
            angry: '😠',
            anxious: '😰',
            calm: '😌'
        };
        return emojis[mood] || '😐';
    }

    capitalizeMood(mood) {
        return mood.charAt(0).toUpperCase() + mood.slice(1);
    }

    resetForm() {
        // Clear selected mood
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Clear notes
        document.getElementById('notes').value = '';
        
        // Reset selected mood
        this.selectedMood = null;
    }

    showMessage(text, type = 'success') {
        // Remove any existing messages
        const existingMessage = document.querySelector('.status-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const message = document.createElement('div');
        message.textContent = text;
        message.className = `status-message ${type} show`;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 3000);
    }

    // Store locally as backup when API is used
    saveToLocalStorage(moodEntry) {
        const moods = JSON.parse(localStorage.getItem('moods')) || [];
        moods.unshift(moodEntry);
        localStorage.setItem('moods', JSON.stringify(moods));
    }
}

// Initialize the mood tracker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MoodTracker();
    
    // Check API health on load
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            console.log('✅ API Health Check:', data);
        })
        .catch(error => {
            console.error('❌ API Health Check Failed:', error);
        });
});
