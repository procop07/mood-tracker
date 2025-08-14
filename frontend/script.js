// Mood Tracker JavaScript
class MoodTracker {
    constructor() {
        this.moods = JSON.parse(localStorage.getItem('moods')) || [];
        this.selectedMood = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.displayMoods();
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
        event.target.classList.add('selected');
        this.selectedMood = event.target.dataset.mood;
    }

    saveMood() {
        if (!this.selectedMood) {
            alert('Please select a mood!');
            return;
        }

        const notes = document.getElementById('notes').value;
        const moodEntry = {
            id: Date.now(),
            mood: this.selectedMood,
            notes: notes,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };

        this.moods.unshift(moodEntry);
        this.saveMoodsToStorage();
        this.displayMoods();
        this.resetForm();
        
        // Show success message
        this.showSuccessMessage();
    }

    saveMoodsToStorage() {
        localStorage.setItem('moods', JSON.stringify(this.moods));
    }

    displayMoods() {
        const moodList = document.getElementById('mood-list');
        
        if (this.moods.length === 0) {
            moodList.innerHTML = '<p style="text-align: center; color: #666;">No mood entries yet. Add your first mood above!</p>';
            return;
        }

        const moodHTML = this.moods.map(mood => `
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

    showSuccessMessage() {
        const message = document.createElement('div');
        message.textContent = 'Mood saved successfully!';
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 1000;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 3000);
    }
}

// Initialize the mood tracker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MoodTracker();
});

// Add some CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
