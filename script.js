document.addEventListener('DOMContentLoaded', async function () {
    initMap();
    const unavailableDates = [];
    const today = new Date();
    let selectedDatesStr = [formatDateToISO(today)];
    async function init() {
    try {
        //console.log("Fetching and setting unavailable dates...");
        //await fetchAndSetUnavailableDates();
        //console.log("Unavailable Dates fetched:", unavailableDates);
        initializeFlatpickr();
        console.log("Flatpickr initialized.");
        await initForm();
        setDefaultValues();
        updateAccommodationOptions(); 
    } catch (error) {
        console.error("Error during initialization:", error);
    }
}

    let flatpickrInstance;

    function initMap() {
        var map = L.map('map').setView([43.94966595273011, 0.2003170552898979], 30); // Paris, France
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        
        L.marker([43.94966595273011, 0.2003170552898979]).addTo(map)
            .bindPopup('Gîte Napoléon')
            .openPopup();
    }
    
    
    function initializeFlatpickr() {
        const currentMonth = today.getMonth();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 2;
        const year = currentMonth === 0 ? today.getFullYear() - 1 : today.getFullYear();
        const firstDayOfPreviousMonth = new Date(year, previousMonth, 1);

        flatpickr("#dateRange", {
            inline: true,
            mode: "multiple",
            locale: "fr",
            dateFormat: "Y-m-d",
            minDate: "today",
            defaultDate: formatDateToISO(firstDayOfPreviousMonth),
            disable: unavailableDates,
            onChange: async function (selectedDates) {
                selectedDatesStr = selectedDates.map(date => formatDateToISO(date));
                console.log("Selected Dates:", selectedDatesStr);

                const isAvailable = await checkAvailability(selectedDatesStr);

                //console.log("Date availability:", isAvailable);
                if (!isAvailable) {
                    alert("Sorry, the selected dates are not available.");
                    this.clear();
                }
                resetAccommodationOption();

            },
            onMonthChange: async function () {
                await fetchAndSetUnavailableDates();
                this.set('disable', unavailableDates);
                console.log("Updated Disabled Dates in Flatpickr:", unavailableDates); 
                disable:unavailableDates;
            },
            onReady: function () {
                const calendar = document.querySelector('.flatpickr-calendar');
                if (calendar) {
                    const dates = calendar.querySelectorAll('.flatpickr-day');
                    dates.forEach(dateElement => {
                        const dateStr = dateElement.getAttribute('data-date');
                        if (unavailableDates.includes(dateStr)) {
                            dateElement.classList.add('disabled-date');
                        }
                    });
                }
            }
        });
    }

    async function initForm() {
        try {
            const roomsRef = ref(db, 'rooms');
            const snapshot = await get(roomsRef);
            if (snapshot.exists()) {
                window.db = { rooms: snapshot.val() };
                console.log("Database rooms:", JSON.stringify(window.db.rooms, null, 2));
            } else {
                console.log("No rooms data available.");
            }
        } catch (error) {
            console.error("Error retrieving rooms data:", error);
        }
    }

    async function fetchAndSetUnavailableDates() {
        const datesToCheck = getAllDatesOfYear(today.getFullYear());
        //console.log("Dates to Check:", datesToCheck);

        try {
            const unavailableDatesTemp = [];
            for (const date of datesToCheck) {
                const allUnavailable = await checkAllRoomsUnavailable(date);
                //console.log(`Date ${date} availability status:`, allUnavailable);
                if (allUnavailable) {
                    unavailableDatesTemp.push(date);
                }
            }
            unavailableDates.length = 0;
            unavailableDates.push(...unavailableDatesTemp);
            //console.log("Processed Unavailable Dates:", unavailableDates);
        } catch (error) {
            console.error("Error fetching or processing dates:", error);
        }
    }

    async function checkAllRoomsUnavailable(date) {
        const rooms = window.db?.rooms || {};
        let isAllRoomsUnavailable = true;
        //console.log(`Checking availability for date: ${date}`);
        for (const [roomName, room] of Object.entries(rooms)) {
            const availability = room.availability[date];
            //console.log(`Room ${roomName} availability on ${date}:`, availability);
            if (availability > 0 || availability === undefined) {
                isAllRoomsUnavailable = false;
                break;
            }
        }
        return isAllRoomsUnavailable;
    }

    function getAllDatesOfYear(year) {
        const dates = [];
        for (let month = 0; month < 12; month++) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                dates.push(formatDateToISO(date));
            }
        }
        return dates;
    }

    function formatDateToISO(date) {
        const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        return utcDate.toISOString().split('T')[0];
    }

    async function checkAvailability(dates) {
        return !dates.some(date => unavailableDates.includes(date));
    }

    function setDefaultValues() {
        numberOfPeopleInput.value = 1;
        handlePeopleDetails();
        calculatePrice();
    }
    const dateRangeInput = document.querySelector('#dateRange');
    const numberOfPeopleInput = document.getElementById('numberOfPeople');
    const accommodationSelect = document.getElementById('accommodation');
    const breakfastSelect = document.getElementById('breakfast');
    const reserveButton = document.getElementById('reserveButton');
    const peopleDetails = document.getElementById('peopleDetails');
    const priceDisplay = document.getElementById('price');
    
    const paypalContainer = document.getElementById('paypal-button-container');
    reserveButton.addEventListener('click', () => {
        // Sélectionne tous les champs de formulaire
        const formElements = document.querySelectorAll('#bookingForm input, #bookingForm select, #bookingForm textarea, #bookingForm button');
        
        // Désactive tous les éléments du formulaire
        formElements.forEach(element => {
            element.disabled = true;
        });
    });

    dateRangeInput.addEventListener('change', calculatePrice);
    dateRangeInput.addEventListener('change', updateAccommodationOptions);
    numberOfPeopleInput.addEventListener('change', handlePeopleDetails);

    accommodationSelect.addEventListener('change', updateAccommodationOptions); // Update options on change
    if (breakfastSelect) {
        breakfastSelect.addEventListener('change', calculatePrice);
    }

    function showStep(stepId) {
        const steps = document.querySelectorAll('.form-step');
        steps.forEach(step => {
            if (step.id === stepId) {
                step.style.display = 'block';
            } 
        });
    }

    function handlePeopleDetails() {
        peopleDetails.innerHTML = '';
        
        const numberOfPeople = parseInt(numberOfPeopleInput.value);
        const gridContainer = document.createElement('div');
        gridContainer.className = 'people-grid';
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        gridContainer.style.gap = '16px';
    
        for (let i = 0; i < numberOfPeople; i++) {
            const personDiv = document.createElement('div');
            personDiv.className = 'person-details';
            personDiv.style.border = '1px solid #ccc';
            personDiv.style.padding = '10px';
            personDiv.style.borderRadius = '5px';
            personDiv.innerHTML = `
                <h3>Personne ${i + 1}</h3>
                <div>
                    <label for="name${i}">Nom:</label>
                    <input type="text" id="name${i}" name="name${i}" required>
                </div>
                <div>
                    <label for="firstName${i}">Prénom:</label>
                    <input type="text" id="firstName${i}" name="firstName${i}" required>
                </div>
            `;
            gridContainer.appendChild(personDiv);
        }
    
        peopleDetails.appendChild(gridContainer);
    
        const majorSelectionDiv = document.createElement('div');
        majorSelectionDiv.className = 'major-selection';
        majorSelectionDiv.style.marginTop = '20px';
        majorSelectionDiv.innerHTML = `
            <label for="numAdults">Nombre de personnes majeures :</label>
            <select id="numAdults" name="numAdults" required>
                ${Array.from({ length: numberOfPeople + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}
            </select>
        `;
    
        peopleDetails.appendChild(majorSelectionDiv);
        const numAdults = document.getElementById('numAdults');
        if (numAdults) {
            numAdults.addEventListener('change', calculatePrice);
        }
        calculatePrice();  // Updated price calculation
        validateForm();    // Validate form
    }
    

    function updateAccommodationOptions() {
        const selectedAccommodation = accommodationSelect.value;

        if (selectedAccommodation === 'fullRoom') {
            breakfastSelect.innerHTML = `
                <option value="included">Oui - 0€ (inclus dans le prix de la chambre)</option>
                <option value="notIncluded">Non</option>
            `;
        } else if (selectedAccommodation === 'dormitory') {
            breakfastSelect.innerHTML = `
                <option value="notIncluded">Non</option>
                <option value="included">Oui - 7€/personne</option>
            `;
        } else {
            breakfastSelect.innerHTML = `
                <option value="1">Veuillez choisir</option>
                <option value="notIncluded">Non</option>
                <option value="included">Oui - 7€/personne</option>
            `;
        }

        updateOptionsAvailability();
    }
    function resetAccommodationOption() {
        accommodationSelect.value = "1";
        calculatePrice();
    }
    
    async function updateOptionsAvailability() {
        const numberOfPeople = parseInt(numberOfPeopleInput.value);
        const rooms = window.db?.rooms || {};
        let isFullRoomAvailable = true;
        let totalDormitoryCapacity = 0;
    
        if (!selectedDatesStr.length) {
            console.error("Aucune date sélectionnée");
            return;
        }
    
        // Vérification pour les chambres complètes
        for (const selectedDate of selectedDatesStr) {
            const isAvailableForDate = Object.values(rooms).some(room => {
                    const availability = room.availability[selectedDate];
                    // Si disponibilité est indéfinie pour cette date, la chambre complète est disponible
                    return availability === undefined;
            });
    
            if (!isAvailableForDate) {
                isFullRoomAvailable = false;
                console.log("pas de chambre complète libre");
                break;
            }
        }
    
        // Mise à jour de l'état de l'option chambre complète
        const fullRoomOption = accommodationSelect.querySelector('option[value="fullRoom"]');
        if (!isFullRoomAvailable) {
            fullRoomOption.disabled = true;
            fullRoomOption.style.opacity = '0.5';
        } else {
            fullRoomOption.disabled = false;
            fullRoomOption.style.opacity = '1';
        }
        
        // Vérification pour les dortoirs
        for (const selectedDate of selectedDatesStr) {
            let dailyDormitoryCapacity = 0;
            for (const room of Object.values(rooms)) {
                    const availability = room.availability[selectedDate];
                    const capacity = availability !== undefined ? availability : room.total_places;
                    dailyDormitoryCapacity += capacity;
                    console.log("dormcap",dailyDormitoryCapacity);
                   
                
            }
    
            totalDormitoryCapacity = Math.max(totalDormitoryCapacity, dailyDormitoryCapacity);
            console.log(`Date: ${selectedDate}, Daily Dormitory Capacity: ${dailyDormitoryCapacity}`);
        }
    
        console.log("Total Dormitory Capacity after all dates:", totalDormitoryCapacity);
    
        // Mise à jour de l'état de l'option dortoir
        const isDormitoryAvailable = numberOfPeople <= totalDormitoryCapacity;
        const dormitoryOption = accommodationSelect.querySelector('option[value="dormitory"]');
        if (!isDormitoryAvailable) {
            dormitoryOption.disabled = true;
            dormitoryOption.style.opacity = '0.5';
        } else {
            dormitoryOption.disabled = false;
            dormitoryOption.style.opacity = '1';
        }
    }
    
    numberOfPeopleInput.addEventListener('input', updateOptionsAvailability);
    numberOfPeopleInput.addEventListener('input', calculatePrice);
    numberOfPeopleInput.addEventListener('input', resetAccommodationOption());
    peopleDetails.addEventListener('change', validateForm);
    accommodationSelect.addEventListener('change', validateForm);
    accommodationSelect.addEventListener('input', calculatePrice);
    breakfastSelect.addEventListener('input', calculatePrice);
    dateRangeInput.addEventListener('change', validateForm);

    function validateForm() {
        const numberOfPeople = parseInt(numberOfPeopleInput.value);
        const accommodationType = accommodationSelect.value;
        const breakfastOption = breakfastSelect.value;
        const datesSelected = selectedDatesStr.length > 0;
    
        // Check if all fields are filled
        const peopleInputs = peopleDetails.querySelectorAll('input');
        const arePeopleDetailsFilled = Array.from(peopleInputs).every(input => input.value.trim() !== '');
        
        // Validate each field and highlight in red if not filled
        if (numberOfPeople > 0) {
            numberOfPeopleInput.style.borderColor = '';
        } else {
            numberOfPeopleInput.style.borderColor = 'red';
        }
    
        if (accommodationType !== "1") {
            accommodationSelect.style.borderColor = '';
        } else {
            accommodationSelect.style.borderColor = 'red';
        }
    
        if (breakfastOption !== "1") {
            breakfastSelect.style.borderColor = '';
        } else {
            breakfastSelect.style.borderColor = 'red';
        }
    
        if (datesSelected) {
            // Assuming you have a way to indicate selected dates visually
            document.querySelector('#dateRange').style.borderColor = '';
        } else {
            document.querySelector('#dateRange').style.borderColor = 'red';
        }
    
        if (arePeopleDetailsFilled) {
            peopleInputs.forEach(input => input.style.borderColor = '');
        } else {
            peopleInputs.forEach(input => {
                if (input.value.trim() === '') {
                    input.style.borderColor = 'red';
                }
            });
        }
    
    
        // Check if form is valid
        const isFormValid = numberOfPeople > 0 && accommodationType !== "1" && breakfastOption !== "1" && datesSelected && arePeopleDetailsFilled && numAdults !== undefined && numAdults !== "";
    
        // Enable or disable the reserve button based on validation
        reserveButton.disabled = !isFormValid;
    }
    
    function calculatePrice() {
        const accommodationType = accommodationSelect.value;
        const numberOfPeople = parseInt(numberOfPeopleInput.value);
        const numAdults = parseInt(document.getElementById('numAdults')?.value || '0');
        let price = 0;
    
        if (accommodationType === 'fullRoom') {
            price = 0.010;
        } else if (accommodationType === 'dormitory') {
            price = 20 * numberOfPeople;
            if (breakfastSelect.value === 'included') {
                price += 7 * numberOfPeople;
            }
        }
    
        // Adding 0.75€ per adult
        price += 0.75 * numAdults;
    
        // Multiply by the number of selected dates
        price *= selectedDatesStr.length;
    
        // Update the displayed price
        priceDisplay.textContent = `${price.toFixed(2)}€`;
    }
    
    
    reserveButton.addEventListener('click', async function () {
        this.style.display = 'none';
        paypalContainer.style.display = 'block';
    });

    showStep('step1');

    document.getElementById('nextToStep2').addEventListener('click', function () {
        showStep('step2');
        this.style.display = 'none';
    });

    document.getElementById('nextToStep3').addEventListener('click', function () {
        showStep('step3');
        updateOptionsAvailability();
        this.style.display = 'none';
    });

    document.getElementById('nextToStep4').addEventListener('click', function () {
        showStep('step4');
        this.style.display = 'none';
    });

    document.getElementById('nextToStep5').addEventListener('click', function () {
        showStep('step5');
        this.style.display = 'none';
    });
    function calculateAmountWithFees(amount) {
        const percentageFee = 0.029; // 2.9% en fraction
        const fixedFee = 0.35; // 0.35 EUR
        const price = (amount + fixedFee) / (1 - percentageFee);
        return price.toFixed(2); // Limiter à 2 décimales
    }
    paypal.Buttons({
        createOrder: function (data, actions) {
            const priceDisplay = document.getElementById('price');
            if (!priceDisplay) {
                console.error('L\'élément avec l\'ID "price" est introuvable.');
                return;
            }
    
            const priceToReceive = parseFloat(priceDisplay.textContent.replace('€', ''));
            const amountToCharge = calculateAmountWithFees(priceToReceive);
            
            console.log('Price to Receive:', priceToReceive);
            console.log('Amount to Charge:', amountToCharge);
            
            return actions.order.create({
                purchase_units: [{
                    amount: {
                        value: amountToCharge
                    }
                }]
            });
        },
        onApprove: function (data, actions) {
            return actions.order.capture().then(function (details) {
                window.location.href = 'https://gitetest.github.io/gitest/'; // Remplacez par l'URL de redirection souhaitée
            });
        },
        onError: function(err) {
            console.error('Une erreur est survenue lors du traitement du paiement :', err);
            alert('Une erreur est survenue. Veuillez réessayer.');
        }
    }).render('#paypal-button-container');
    
    init();
    
});
