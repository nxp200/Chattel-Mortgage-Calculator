// DOM Elements
const loanAmountInput = document.getElementById('loan-amount');
const interestRateInput = document.getElementById('interest-rate');
const loanTermInput = document.getElementById('loan-term');
const balloonPaymentInput = document.getElementById('balloon-payment');
const paymentFrequencySelect = document.getElementById('payment-frequency');
const feesInput = document.getElementById('fees');
const calculateBtn = document.getElementById('calculate-btn');
const resultsContainer = document.getElementById('results-container');

// Result Elements
const regularPaymentElement = document.getElementById('regular-payment');
const balloonAmountElement = document.getElementById('balloon-amount');
const totalRepaymentsElement = document.getElementById('total-repayments');
const totalInterestElement = document.getElementById('total-interest');
// Total loan element removed
const totalCostElement = document.getElementById('total-cost');
const amortizationBody = document.getElementById('amortization-body');

// Chart
let repaymentChart = null;
let balanceChart = null; // For the loan balance chart

// Tab switching for charts
function setupChartTabs() {
    const tabRepayment = document.getElementById('tab-repayment');
    const tabBalance = document.getElementById('tab-balance');
    const repaymentContent = document.getElementById('repayment-chart-content');
    const balanceContent = document.getElementById('balance-chart-content');

    if (!tabRepayment || !tabBalance) return;

    tabRepayment.addEventListener('click', function() {
        tabRepayment.classList.add('active');
        tabBalance.classList.remove('active');
        repaymentContent.classList.remove('hidden');
        balanceContent.classList.add('hidden');
        // Resize chart if needed
        if (repaymentChart) repaymentChart.resize();
    });
    tabBalance.addEventListener('click', function() {
        tabBalance.classList.add('active');
        tabRepayment.classList.remove('active');
        balanceContent.classList.remove('hidden');
        repaymentContent.classList.add('hidden');
        // Resize chart if needed
        if (balanceChart) balanceChart.resize();
    });
}

// Draw/Update the loan balance chart
function updateBalanceChart(schedule, periodsPerYear, totalPeriods, isYearly = false) {
    const ctx = document.getElementById('balance-chart').getContext('2d');
    // Clear existing chart if it exists
    if (balanceChart) {
        balanceChart.destroy();
    }
    const labels = [];
    const balanceData = [];
    const principalPaidData = [];
    const interestPaidData = [];
    if (isYearly) {
        // Group by year
        let currentYear = 1;
        let lastBalance = null;
        let cumulativePrincipal = 0;
        let cumulativeInterest = 0;
        for (let i = 0; i < schedule.length; i++) {
            if (i % periodsPerYear === 0) {
                labels.push(`Year ${currentYear}`);
                currentYear++;
            }
            lastBalance = schedule[i].balance;
            cumulativePrincipal += schedule[i].principal;
            cumulativeInterest += schedule[i].interest;
            // For last period in year or last period overall, push data
            if ((i + 1) % periodsPerYear === 0 || i === schedule.length - 1) {
                balanceData.push(lastBalance);
                principalPaidData.push(cumulativePrincipal);
                interestPaidData.push(cumulativeInterest);
            }
        }
    } else {
        // Monthly/periodic
        let frequencyValue;
        if (periodsPerYear === 12) frequencyValue = 'monthly';
        else if (periodsPerYear === 26) frequencyValue = 'fortnightly';
        else if (periodsPerYear === 52) frequencyValue = 'weekly';
        else frequencyValue = 'monthly';
        let cumulativePrincipal = 0;
        let cumulativeInterest = 0;
        for (let i = 0; i < schedule.length; i++) {
            labels.push(getPeriodLabel(i + 1, frequencyValue));
            balanceData.push(schedule[i].balance);
            cumulativePrincipal += schedule[i].principal;
            cumulativeInterest += schedule[i].interest;
            principalPaidData.push(cumulativePrincipal);
            interestPaidData.push(cumulativeInterest);
        }
    }
    balanceChart = new Chart(ctx, {
        type: isYearly ? 'bar' : 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Loan Balance',
                    data: balanceData,
                    backgroundColor: isYearly ? '#1976d2' : 'rgba(25, 118, 210, 0.08)',
                    borderColor: '#1976d2',
                    borderWidth: isYearly ? 1 : 2,
                    tension: isYearly ? 0 : 0.1,
                    fill: !isYearly,
                    pointRadius: isYearly ? 0 : 2,
                    yAxisID: 'y',
                },
                {
                    label: 'Total Principal Paid',
                    data: principalPaidData,
                    backgroundColor: 'rgba(76, 175, 80, 0.08)',
                    borderColor: '#4caf50',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false,
                    pointRadius: 2,
                    type: 'line',
                    yAxisID: 'y',
                },
                {
                    label: 'Total Interest Paid',
                    data: interestPaidData,
                    backgroundColor: 'rgba(255, 152, 0, 0.08)',
                    borderColor: '#ff9800',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false,
                    pointRadius: 2,
                    type: 'line',
                    yAxisID: 'y',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: isYearly ? labels.length : Math.min(12, Math.ceil(labels.length / 4)),
                        callback: function(val, index) {
                            if (!isYearly && labels.length > 12) {
                                const skipFactor = labels.length > 60 ? 12 : 6;
                                return index % skipFactor === 0 ? labels[index] : '';
                            }
                            return labels[index];
                        }
                    }
                },
                y: {
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}


// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    setupChartTabs();
    // Add event listener to the calculate button
    calculateBtn.addEventListener('click', performCalculation);
    
    // Add event listener to the display toggle
    const displayToggle = document.getElementById('display-toggle');
    const displayModeText = document.getElementById('display-mode');
    
    displayToggle.addEventListener('change', function() {
        const isYearly = this.checked;
        
        // Update both the amortization table and chart with the current schedule
        if (currentSchedule && currentFrequency) {
            updateAmortizationTable(currentSchedule, currentFrequency, isYearly);
            // Also update the chart to match the display mode
            updateChart(currentSchedule, getPeriodsPerYear(currentFrequency), currentSchedule.length, isYearly);
        }
    });
    
    // Automatically perform calculation with default values on page load
    performCalculation();
});

// Format currency function
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', { 
        style: 'currency', 
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

// Calculate payments
const calculatePayments = (loanAmount, interestRate, loanTerm, balloonPercentage, paymentFrequency, fees) => {
    // Convert annual interest rate to decimal and then to per-period rate
    const periodsPerYear = getPeriodsPerYear(paymentFrequency);
    const totalPeriods = loanTerm * periodsPerYear;
    const periodicInterestRate = (interestRate / 100) / periodsPerYear;
    
    // Calculate balloon payment amount
    const balloonAmount = (balloonPercentage / 100) * loanAmount;
    
    // Adjust loan amount for fees if they're being financed
    const loanPrincipal = loanAmount + fees;
    
    // Calculate regular payment using the amortization formula with balloon
    let regularPayment;
    
    if (periodicInterestRate === 0) {
        // For 0% interest rate
        regularPayment = (loanPrincipal - balloonAmount) / totalPeriods;
    } else {
        // For normal interest rates
        regularPayment = (loanPrincipal - balloonAmount * Math.pow(1 + periodicInterestRate, -totalPeriods)) * 
            (periodicInterestRate / (1 - Math.pow(1 + periodicInterestRate, -totalPeriods)));
    }
    
    // Generate amortization schedule
    const schedule = [];
    let balance = loanPrincipal;
    let totalInterest = 0;
    
    for (let period = 1; period <= totalPeriods; period++) {
        const interestPayment = balance * periodicInterestRate;
        let principalPayment = regularPayment - interestPayment;
        
        // Handle last payment with balloon
        if (period === totalPeriods) {
            principalPayment = balance - balloonAmount;
        }
        
        totalInterest += interestPayment;
        balance -= principalPayment;
        
        // Ensure balance doesn't go below the balloon amount in the last period
        if (period === totalPeriods) {
            balance = balloonAmount;
        }
        
        schedule.push({
            period,
            payment: regularPayment,
            principal: principalPayment,
            interest: interestPayment,
            balance
        });
    }
    
    const totalRepayments = (regularPayment * totalPeriods) + balloonAmount;
    
    return {
        regularPayment,
        balloonAmount,
        totalRepayments,
        totalInterest,
        totalCost: totalRepayments + fees,
        schedule,
        periodsPerYear,
        totalPeriods
    };
};

// Get periods per year based on payment frequency
const getPeriodsPerYear = (frequency) => {
    switch (frequency) {
        case 'weekly':
            return 52;
        case 'fortnightly':
            return 26;
        case 'monthly':
        default:
            return 12;
    }
};

// Create or update the repayment chart
const updateChart = (schedule, periodsPerYear, totalPeriods, isYearly = false) => {
    const ctx = document.getElementById('repayment-chart').getContext('2d');
    
    // Clear existing chart if it exists
    if (repaymentChart) {
        repaymentChart.destroy();
    }
    
    // Prepare data for the chart
    const labels = [];
    const principalData = [];
    const interestData = [];
    
    if (isYearly) {
        // Group data by year for yearly visualization
        const yearsData = [];
        let currentYear = 1;
        let yearlyPrincipal = 0;
        let yearlyInterest = 0;
        
        schedule.forEach((payment, index) => {
            if (index % periodsPerYear === 0 && index !== 0) {
                yearsData.push({
                    year: currentYear,
                    principal: yearlyPrincipal,
                    interest: yearlyInterest
                });
                
                currentYear++;
                yearlyPrincipal = 0;
                yearlyInterest = 0;
            }
            
            yearlyPrincipal += payment.principal;
            yearlyInterest += payment.interest;
            
            // For the last period if it doesn't complete a year
            if (index === schedule.length - 1 && index % periodsPerYear !== 0) {
                yearsData.push({
                    year: currentYear,
                    principal: yearlyPrincipal,
                    interest: yearlyInterest
                });
            }
        });
        
        // Prepare chart data from yearly data
        yearsData.forEach(yearData => {
            labels.push(`Year ${yearData.year}`);
            principalData.push(yearData.principal);
            interestData.push(yearData.interest);
        });
    } else {
        // Show all months/periods
        // For monthly view, we need to pass a standardized frequency value
        // We'll determine what it likely is based on periodsPerYear
        let frequencyValue;
        if (periodsPerYear === 12) frequencyValue = 'monthly';
        else if (periodsPerYear === 26) frequencyValue = 'fortnightly';
        else if (periodsPerYear === 52) frequencyValue = 'weekly';
        else frequencyValue = 'monthly'; // Default
        
        for (let i = 0; i < schedule.length; i++) {
            const payment = schedule[i];
            labels.push(getPeriodLabel(i + 1, frequencyValue));
            principalData.push(payment.principal);
            interestData.push(payment.interest);
        }
    }
    
    // Create the chart
    repaymentChart = new Chart(ctx, {
        type: isYearly ? 'bar' : 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Principal',
                    data: principalData,
                    backgroundColor: isYearly ? '#4361ee' : 'rgba(67, 97, 238, 0.1)',
                    borderColor: '#4361ee',
                    borderWidth: isYearly ? 1 : 2,
                    tension: isYearly ? 0 : 0.1,
                    fill: !isYearly,
                    pointRadius: isYearly ? 0 : 2
                },
                {
                    label: 'Interest',
                    data: interestData,
                    backgroundColor: isYearly ? '#ff9800' : 'rgba(255, 152, 0, 0.1)',
                    borderColor: '#ff9800',
                    borderWidth: isYearly ? 1 : 2,
                    tension: isYearly ? 0 : 0.1,
                    fill: !isYearly,
                    pointRadius: isYearly ? 0 : 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: isYearly,
                    ticks: {
                        // For monthly view with many points, show fewer labels on x-axis
                        maxTicksLimit: isYearly ? labels.length : Math.min(12, Math.ceil(labels.length / 4)),
                        callback: function(val, index) {
                            // For monthly view with many points, only show some labels
                            if (!isYearly && labels.length > 12) {
                                // For loans longer than a year, show every 6th or 12th month
                                const skipFactor = labels.length > 60 ? 12 : 6;
                                return index % skipFactor === 0 ? labels[index] : '';
                            }
                            return labels[index];
                        }
                    }
                },
                y: {
                    stacked: isYearly,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            }
        }
    });
};

// Store current schedule and frequency for toggle reference
let currentSchedule = null;
let currentFrequency = null;

// Update the amortization table
const updateAmortizationTable = (schedule, frequency, yearlyDisplay = false) => {
    // Store current values for reference when toggling
    currentSchedule = schedule;
    currentFrequency = frequency;
    
    amortizationBody.innerHTML = '';
    
    if (yearlyDisplay) {
        // Show yearly summary
        displayYearlySummary(schedule, frequency);
    } else {
        // Show monthly details
        displayMonthlyDetails(schedule, frequency);
    }
};

// Display monthly payment details
const displayMonthlyDetails = (schedule, frequency) => {
    // Determine how many periods to show initially (first year)
    const periodsPerYear = getPeriodsPerYear(frequency);
    const maxInitialPeriods = Math.min(periodsPerYear, schedule.length);
    
    for (let i = 0; i < maxInitialPeriods; i++) {
        addPaymentRow(schedule[i], i + 1, frequency);
    }
    
    // If there are more periods than shown initially, add a "Show more" row
    if (schedule.length > maxInitialPeriods) {
        const showMoreRow = document.createElement('tr');
        const showMoreCell = document.createElement('td');
        showMoreCell.colSpan = 5;
        showMoreCell.textContent = 'Show more...';
        showMoreCell.style.textAlign = 'center';
        showMoreCell.style.cursor = 'pointer';
        showMoreCell.style.color = '#4361ee';
        
        showMoreCell.addEventListener('click', () => {
            // When clicked, show all periods
            const displayToggle = document.getElementById('display-toggle');
            const isYearly = displayToggle.checked;
            
            if (isYearly) {
                displayFullYearlySummary(schedule, frequency);
            } else {
                displayFullMonthlyDetails(schedule, frequency);
            }
            showMoreRow.remove();
        });
        
        showMoreRow.appendChild(showMoreCell);
        amortizationBody.appendChild(showMoreRow);
    }
};

// Display yearly payment summaries
const displayYearlySummary = (schedule, frequency) => {
    const periodsPerYear = getPeriodsPerYear(frequency);
    const years = Math.ceil(schedule.length / periodsPerYear);
    const maxInitialYears = Math.min(3, years); // Show first 3 years by default
    
    for (let year = 0; year < maxInitialYears; year++) {
        const yearlyData = calculateYearlyData(schedule, year, periodsPerYear);
        addYearlyRow(yearlyData, year + 1);
    }
    
    // If there are more years than shown initially, add a "Show more" row
    if (years > maxInitialYears) {
        const showMoreRow = document.createElement('tr');
        const showMoreCell = document.createElement('td');
        showMoreCell.colSpan = 5;
        showMoreCell.textContent = 'Show more...';
        showMoreCell.style.textAlign = 'center';
        showMoreCell.style.cursor = 'pointer';
        showMoreCell.style.color = '#4361ee';
        
        showMoreCell.addEventListener('click', () => {
            // When clicked, show all years
            displayFullYearlySummary(schedule, frequency);
            showMoreRow.remove();
        });
        
        showMoreRow.appendChild(showMoreCell);
        amortizationBody.appendChild(showMoreRow);
    }
};

// Calculate yearly data from monthly payments
const calculateYearlyData = (schedule, year, periodsPerYear) => {
    const startIndex = year * periodsPerYear;
    const endIndex = Math.min(startIndex + periodsPerYear, schedule.length);
    
    let totalPayment = 0;
    let totalPrincipal = 0;
    let totalInterest = 0;
    let finalBalance = 0;
    
    for (let i = startIndex; i < endIndex; i++) {
        if (i < schedule.length) {
            const payment = schedule[i];
            totalPayment += payment.payment;
            totalPrincipal += payment.principal;
            totalInterest += payment.interest;
            finalBalance = payment.balance; // Last payment's balance will be the final
        }
    }
    
    return {
        payment: totalPayment,
        principal: totalPrincipal,
        interest: totalInterest,
        balance: finalBalance
    };
};

// Add a payment row to the amortization table
const addPaymentRow = (payment, periodNumber, frequency) => {
    const row = document.createElement('tr');
    
    // Create period cell
    const periodCell = document.createElement('td');
    periodCell.textContent = getPeriodLabel(periodNumber, frequency);
    row.appendChild(periodCell);
    
    // Create payment cell
    const paymentCell = document.createElement('td');
    paymentCell.textContent = formatCurrency(payment.payment);
    row.appendChild(paymentCell);
    
    // Create principal cell
    const principalCell = document.createElement('td');
    principalCell.textContent = formatCurrency(payment.principal);
    row.appendChild(principalCell);
    
    // Create interest cell
    const interestCell = document.createElement('td');
    interestCell.textContent = formatCurrency(payment.interest);
    row.appendChild(interestCell);
    
    // Create balance cell
    const balanceCell = document.createElement('td');
    balanceCell.textContent = formatCurrency(payment.balance);
    row.appendChild(balanceCell);
    
    amortizationBody.appendChild(row);
};

// Add a yearly summary row to the amortization table
const addYearlyRow = (yearData, yearNumber) => {
    const row = document.createElement('tr');
    
    // Create year cell
    const yearCell = document.createElement('td');
    yearCell.textContent = `Year ${yearNumber}`;
    row.appendChild(yearCell);
    
    // Create payment cell
    const paymentCell = document.createElement('td');
    paymentCell.textContent = formatCurrency(yearData.payment);
    row.appendChild(paymentCell);
    
    // Create principal cell
    const principalCell = document.createElement('td');
    principalCell.textContent = formatCurrency(yearData.principal);
    row.appendChild(principalCell);
    
    // Create interest cell
    const interestCell = document.createElement('td');
    interestCell.textContent = formatCurrency(yearData.interest);
    row.appendChild(interestCell);
    
    // Create balance cell
    const balanceCell = document.createElement('td');
    balanceCell.textContent = formatCurrency(yearData.balance);
    row.appendChild(balanceCell);
    
    amortizationBody.appendChild(row);
};

// Display full monthly details
const displayFullMonthlyDetails = (schedule, frequency) => {
    amortizationBody.innerHTML = '';
    for (let i = 0; i < schedule.length; i++) {
        addPaymentRow(schedule[i], i + 1, frequency);
    }
};

// Display full yearly summary
const displayFullYearlySummary = (schedule, frequency) => {
    const periodsPerYear = getPeriodsPerYear(frequency);
    const years = Math.ceil(schedule.length / periodsPerYear);
    
    amortizationBody.innerHTML = '';
    for (let year = 0; year < years; year++) {
        const yearlyData = calculateYearlyData(schedule, year, periodsPerYear);
        addYearlyRow(yearlyData, year + 1);
    }
};

// Toggle display between monthly and yearly view
const toggleDisplay = () => {
    const displayToggle = document.getElementById('display-toggle');
    const isYearly = displayToggle.checked;
    
    if (isYearly) {
        displayFullYearlySummary(currentSchedule, currentFrequency);
    } else {
        displayFullMonthlyDetails(currentSchedule, currentFrequency);
    }
};

// Function removed - functionality moved to displayFullMonthlyDetails

// Get the period label based on frequency
const getPeriodLabel = (period, frequency) => {
    switch (frequency) {
        case 'weekly':
            return `Week ${period}`;
        case 'fortnightly':
            return `Fortnight ${period}`;
        case 'monthly':
        default:
            return `Month ${period}`;
    }
};

// Main calculation function
const performCalculation = () => {
    // Get input values
    const loanAmount = parseFloat(loanAmountInput.value);
    const interestRate = parseFloat(interestRateInput.value);
    const loanTerm = parseFloat(loanTermInput.value);
    const balloonPercentage = parseFloat(balloonPaymentInput.value);
    const paymentFrequency = paymentFrequencySelect.value;
    const fees = parseFloat(feesInput.value);
    
    // Validate inputs
    if (isNaN(loanAmount) || isNaN(interestRate) || isNaN(loanTerm) || isNaN(balloonPercentage) || isNaN(fees)) {
        alert('Please fill in all fields with valid numbers.');
        return;
    }
    
    // Calculate payments with the loan amount plus fees
    const result = calculatePayments(
        loanAmount, 
        interestRate,
        loanTerm,
        balloonPercentage,
        paymentFrequency,
        fees
    );
    
    // Update UI with results
    regularPaymentElement.textContent = formatCurrency(result.regularPayment);
    balloonAmountElement.textContent = formatCurrency(result.balloonAmount);
    totalRepaymentsElement.textContent = formatCurrency(result.totalRepayments);
    totalInterestElement.textContent = formatCurrency(result.totalInterest);
    
    // Total loan element removed
    
    totalCostElement.textContent = formatCurrency(result.totalCost);
    
    // Get the current display toggle state
    const displayToggle = document.getElementById('display-toggle');
    const isYearly = displayToggle ? displayToggle.checked : false;
    
    // Update chart with the current display mode
    updateChart(result.schedule, result.periodsPerYear, result.totalPeriods, isYearly);
    updateBalanceChart(result.schedule, result.periodsPerYear, result.totalPeriods, isYearly);
    
    // Update amortization table with the current display mode
    updateAmortizationTable(result.schedule, paymentFrequency, isYearly);
    
    // Show results container
    resultsContainer.classList.remove('hidden');
};
