// Variables globales
let csvData = [];
let currentDate = null;
let riskComparisonChart = null;
let correlationChart = null;

// Elementos del DOM
const fileInput = document.getElementById('file-input');
const dateFilter = document.getElementById('date-filter');
const historicalPeriod = document.getElementById('historical-period');
const exportPdfBtn = document.getElementById('export-pdf');
const kpiDate = document.getElementById('kpi-date');
const maxRiskUv = document.getElementById('max-risk-uv');
const maxRiskProb = document.getElementById('max-risk-prob');
const priorityCount = document.getElementById('priority-count');
const priorityTbody = document.getElementById('priority-tbody');
const chronicTbody = document.getElementById('chronic-tbody');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Event listeners
    fileInput.addEventListener('change', handleFileUpload);
    dateFilter.addEventListener('change', handleDateChange);
    historicalPeriod.addEventListener('change', updateChronicPoints);
    exportPdfBtn.addEventListener('click', exportToPdf);
    
    // Deshabilitar botones inicialmente
    exportPdfBtn.disabled = true;
});

// Manejar carga de archivo
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
        header: true,
        delimiter: ";", // PUNTO Y COMA como delimitador
        skipEmptyLines: true,
        complete: function(results) {
            if (results.errors.length > 0) {
                console.error('Errores de parsing:', results.errors);
                alert('Error al procesar el archivo: ' + results.errors[0].message);
                return;
            }
            
            console.log('Datos parseados:', results.data);
            
            // Verificar que tenemos datos
            if (results.data.length === 0) {
                alert('El archivo está vacío o no contiene datos válidos');
                return;
            }
            
            // Verificar que tenemos las columnas esperadas
            const expectedColumns = ['Fecha', 'Lluvia_Predicha_mm', 'Riesgo_Predicho', 'Probabilidad_Riesgo_Alto', 'Unidad_Vecinal'];
            const firstRow = results.data[0];
            const foundColumns = Object.keys(firstRow);
            const hasRequiredColumns = expectedColumns.every(col => foundColumns.includes(col));
            
            if (!hasRequiredColumns) {
                alert(`El archivo CSV debe contener las columnas: ${expectedColumns.join(', ')}\nColumnas encontradas: ${foundColumns.join(', ')}`);
                return;
            }
            
            // Procesar datos
            processData(results.data);
            // Habilitar exportación
            exportPdfBtn.disabled = false;
            
            alert(`Archivo cargado exitosamente: ${results.data.length} registros procesados`);
        },
        error: function(error) {
            console.error('Error:', error);
            alert('Error al leer el archivo: ' + error.message);
        }
    });
}

// Función para detectar el separador decimal
function parseDecimal(value) {
    if (value === null || value === undefined || value === '') return 0;
    
    // Convertir a string por si acaso
    const strValue = String(value).trim();
    
    // Reemplazar coma por punto si es necesario
    const normalized = strValue.replace(',', '.');
    
    // Parsear a float
    const result = parseFloat(normalized);
    
    // Verificar si el parseo fue exitoso
    if (isNaN(result)) {
        console.warn(`Valor no numérico encontrado: "${value}"`);
        return 0;
    }
    
    return result;
}

// Función para formatear fecha (de DD-MM-YYYY a objeto Date)
function parseDate(fechaStr) {
    if (!fechaStr) return null;
    
    try {
        // Asumimos formato DD-MM-YYYY
        const parts = fechaStr.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Meses en JS son 0-based
            const year = parseInt(parts[2]);
            
            // Crear fecha
            const date = new Date(year, month, day);
            
            // Validar que la fecha es válida
            if (isNaN(date.getTime())) {
                console.warn(`Fecha inválida: "${fechaStr}"`);
                return null;
            }
            
            return date;
        }
    } catch (error) {
        console.warn(`Error parseando fecha: "${fechaStr}"`, error);
    }
    
    return null;
}

// Procesar datos del CSV
function processData(data) {
    csvData = [];
    
    data.forEach((row, index) => {
        // Verificar que la fila tenga datos válidos
        if (!row.Fecha || !row.Unidad_Vecinal) {
            console.warn(`Fila ${index + 1} ignorada por datos incompletos:`, row);
            return;
        }
        
        try {
            // Convertir decimales con coma a punto
            const lluviaPredicha = parseDecimal(row.Lluvia_Predicha_mm);
            const probabilidadRiesgo = parseDecimal(row.Probabilidad_Riesgo_Alto);
            
            // Validar riesgo predicho
            const riesgoPredicho = String(row.Riesgo_Predicho).toUpperCase().trim();
            if (riesgoPredicho !== 'ALTO' && riesgoPredicho !== 'BAJO') {
                console.warn(`Riesgo_Predicho inválido en fila ${index + 1}: "${row.Riesgo_Predicho}"`);
                return;
            }
            
            // Parsear fecha
            const fechaObj = parseDate(row.Fecha);
            if (!fechaObj) {
                console.warn(`Fecha inválida en fila ${index + 1}: "${row.Fecha}"`);
                return;
            }
            
            // Crear objeto con datos procesados
            const processedRow = {
                Fecha: row.Fecha,
                FechaObj: fechaObj,
                Lluvia_Predicha_mm: lluviaPredicha,
                Riesgo_Predicho: riesgoPredicho,
                Probabilidad_Riesgo_Alto: probabilidadRiesgo,
                Unidad_Vecinal: row.Unidad_Vecinal.trim()
            };
            
            csvData.push(processedRow);
            
        } catch (error) {
            console.error(`Error procesando fila ${index + 1}:`, error, row);
        }
    });
    
    console.log('Datos procesados:', csvData);
    
    // Ordenar por fecha (más reciente primero)
    csvData.sort((a, b) => b.FechaObj - a.FechaObj);
    
    // Actualizar selector de fechas
    updateDateFilter();
    
    // Establecer fecha más reciente por defecto
    if (csvData.length > 0) {
        const mostRecentDate = csvData[0].Fecha;
        dateFilter.value = mostRecentDate;
        currentDate = mostRecentDate;
        updateDashboard();
    }
}

// Actualizar selector de fechas
function updateDateFilter() {
    // Obtener fechas únicas
    const uniqueDates = [...new Set(csvData.map(item => item.Fecha))].sort((a, b) => 
        new Date(parseDate(b)) - new Date(parseDate(a))
    );
    
    // Actualizar opciones
    dateFilter.innerHTML = '';
    uniqueDates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date; // Mantenemos el formato original DD-MM-YYYY
        dateFilter.appendChild(option);
    });
    
    console.log('Fechas disponibles:', uniqueDates);
}

// Manejar cambio de fecha
function handleDateChange() {
    currentDate = dateFilter.value;
    console.log('Fecha seleccionada:', currentDate);
    updateDashboard();
}

// Actualizar todo el dashboard
function updateDashboard() {
    if (!currentDate || csvData.length === 0) return;
    
    console.log('Actualizando dashboard para fecha:', currentDate);
    
    updateKPI();
    updatePriorityList();
    updateRiskComparisonChart();
    updateChronicPoints();
    updateCorrelationChart();
}

// Actualizar KPI principal
function updateKPI() {
    const dateData = csvData.filter(row => row.Fecha === currentDate);
    
    if (dateData.length === 0) {
        maxRiskUv.textContent = '-';
        maxRiskProb.textContent = '-';
        kpiDate.textContent = '';
        return;
    }
    
    // Encontrar unidad con máximo riesgo
    const maxRisk = dateData.reduce((max, row) => 
        row.Probabilidad_Riesgo_Alto > max.Probabilidad_Riesgo_Alto ? row : max, 
        dateData[0]
    );
    
    maxRiskUv.textContent = maxRisk.Unidad_Vecinal;
    maxRiskProb.textContent = (maxRisk.Probabilidad_Riesgo_Alto * 100).toFixed(1) + '%';
    kpiDate.textContent = currentDate;
    
    console.log('KPI actualizado:', maxRisk.Unidad_Vecinal, maxRisk.Probabilidad_Riesgo_Alto);
}

// Actualizar lista de trabajo priorizada
function updatePriorityList() {
    const dateData = csvData.filter(row => row.Fecha === currentDate);
    
    if (dateData.length === 0) {
        priorityTbody.innerHTML = '<tr><td colspan="4" class="no-data">No hay datos para la fecha seleccionada</td></tr>';
        priorityCount.textContent = '0 unidades';
        return;
    }
    
    // Ordenar por probabilidad de riesgo (descendente)
    dateData.sort((a, b) => b.Probabilidad_Riesgo_Alto - a.Probabilidad_Riesgo_Alto);
    
    // Generar filas de la tabla
    let tableHTML = '';
    dateData.forEach(row => {
        const riskClass = row.Riesgo_Predicho === 'ALTO' ? 'high-risk' : '';
        const riskBadgeClass = row.Riesgo_Predicho === 'ALTO' ? 'risk-high' : 'risk-low';
        
        tableHTML += `
            <tr class="${riskClass}">
                <td>${row.Unidad_Vecinal}</td>
                <td>${(row.Probabilidad_Riesgo_Alto * 100).toFixed(1)}%</td>
                <td>${row.Lluvia_Predicha_mm.toFixed(2)}</td>
                <td><span class="risk-badge ${riskBadgeClass}">${row.Riesgo_Predicho}</span></td>
            </tr>
        `;
    });
    
    priorityTbody.innerHTML = tableHTML;
    priorityCount.textContent = `${dateData.length} unidades`;
    
    console.log('Lista priorizada actualizada:', dateData.length, 'unidades');
}

// Actualizar gráfico comparativo de riesgos
function updateRiskComparisonChart() {
    const ctx = document.getElementById('riskComparisonChart').getContext('2d');
    const dateData = csvData.filter(row => row.Fecha === currentDate);
    
    // Destruir gráfico anterior si existe
    if (riskComparisonChart) {
        riskComparisonChart.destroy();
    }
    
    if (dateData.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillText('No hay datos para la fecha seleccionada', 10, 50);
        return;
    }
    
    // Ordenar datos para el gráfico
    const sortedData = [...dateData].sort((a, b) => a.Probabilidad_Riesgo_Alto - b.Probabilidad_Riesgo_Alto);
    const labels = sortedData.map(row => row.Unidad_Vecinal);
    const probabilities = sortedData.map(row => row.Probabilidad_Riesgo_Alto * 100);
    
    // Encontrar índice del valor máximo
    const maxIndex = probabilities.indexOf(Math.max(...probabilities));
    
    // Crear array de colores
    const backgroundColors = probabilities.map((_, index) => 
        index === maxIndex ? 'rgba(231, 76, 60, 0.8)' : 'rgba(52, 152, 219, 0.6)'
    );
    
    const borderColors = probabilities.map((_, index) => 
        index === maxIndex ? 'rgb(231, 76, 60)' : 'rgb(52, 152, 219)'
    );
    
    // Crear gráfico
    riskComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Probabilidad de Riesgo Alto (%)',
                data: probabilities,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Probabilidad de Riesgo Alto (%)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Probabilidad: ${context.parsed.x.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
    
    console.log('Gráfico de comparación actualizado');
}

// Actualizar puntos crónicos
function updateChronicPoints() {
    const period = parseInt(historicalPeriod.value);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - period);
    
    // Filtrar datos por período
    const periodData = csvData.filter(row => {
        const rowDate = row.FechaObj;
        return rowDate >= cutoffDate && row.Riesgo_Predicho === 'ALTO';
    });
    
    if (periodData.length === 0) {
        chronicTbody.innerHTML = '<tr><td colspan="3" class="no-data">No hay alertas de alto riesgo en el período seleccionado</td></tr>';
        return;
    }
    
    // Contar alertas por unidad vecinal
    const alertCounts = {};
    periodData.forEach(row => {
        const uv = row.Unidad_Vecinal;
        alertCounts[uv] = (alertCounts[uv] || 0) + 1;
    });
    
    // Convertir a array y ordenar
    const alertArray = Object.entries(alertCounts)
        .map(([uv, count]) => ({
            uv,
            count,
            percentage: (count / periodData.length * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count);
    
    // Generar tabla
    let tableHTML = '';
    alertArray.forEach(item => {
        tableHTML += `
            <tr>
                <td>${item.uv}</td>
                <td>${item.count}</td>
                <td>${item.percentage}%</td>
            </tr>
        `;
    });
    
    chronicTbody.innerHTML = tableHTML;
    
    console.log('Puntos crónicos actualizados:', alertArray.length, 'unidades con alertas');
}

// Actualizar gráfico de correlación
function updateCorrelationChart() {
    const ctx = document.getElementById('correlationChart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (correlationChart) {
        correlationChart.destroy();
    }
    
    if (csvData.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillText('No hay datos para mostrar', 10, 50);
        return;
    }
    
    // Preparar datos para scatter plot
    const scatterData = csvData.map(row => ({
        x: row.Lluvia_Predicha_mm,
        y: row.Probabilidad_Riesgo_Alto * 100
    }));
    
    // Colores según el riesgo
    const pointBackgroundColors = csvData.map(row => 
        row.Riesgo_Predicho === 'ALTO' ? 'rgba(231, 76, 60, 0.7)' : 'rgba(52, 152, 219, 0.7)'
    );
    
    // Crear gráfico
    correlationChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Todos los datos',
                data: scatterData,
                backgroundColor: pointBackgroundColors,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Lluvia Predicha (mm)'
                    },
                    beginAtZero: true
                },
                y: {
                    title: {
                        display: true,
                        text: 'Probabilidad de Riesgo Alto (%)'
                    },
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const data = csvData[context.dataIndex];
                            return [
                                `Unidad: ${data.Unidad_Vecinal}`,
                                `Lluvia: ${data.Lluvia_Predicha_mm.toFixed(2)} mm`,
                                `Prob. Riesgo: ${(data.Probabilidad_Riesgo_Alto * 100).toFixed(1)}%`,
                                `Riesgo: ${data.Riesgo_Predicho}`
                            ];
                        }
                    }
                }
            }
        }
    });
    
    console.log('Gráfico de correlación actualizado');
}

// Exportar a PDF
function exportToPdf() {
    if (!currentDate || csvData.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    // Crear contenido para el PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('Informe de Riesgo - Cámaras de Aguas Lluvias', 20, 20);
    
    // Fecha
    doc.setFontSize(12);
    doc.text(`Fecha de análisis: ${currentDate}`, 20, 35);
    
    // KPI
    doc.setFontSize(14);
    doc.text('Unidad Vecinal con Máximo Riesgo:', 20, 50);
    doc.setFontSize(12);
    doc.text(`${maxRiskUv.textContent} - ${maxRiskProb.textContent}`, 20, 60);
    
    // Lista de trabajo priorizada
    doc.setFontSize(14);
    doc.text('Lista de Trabajo Priorizada:', 20, 80);
    
    // Crear tabla
    const dateData = csvData.filter(row => row.Fecha === currentDate)
        .sort((a, b) => b.Probabilidad_Riesgo_Alto - a.Probabilidad_Riesgo_Alto);
    
    let yPosition = 95;
    dateData.forEach((row, index) => {
        if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
        }
        
        doc.setFontSize(10);
        const riskIndicator = row.Riesgo_Predicho === 'ALTO' ? '▲' : '●';
        doc.text(`${index + 1}. ${row.Unidad_Vecinal}`, 25, yPosition);
        doc.text(`${(row.Probabilidad_Riesgo_Alto * 100).toFixed(1)}%`, 120, yPosition);
        doc.text(`${row.Lluvia_Predicha_mm.toFixed(2)} mm`, 150, yPosition);
        doc.text(riskIndicator, 180, yPosition);
        
        yPosition += 7;
    });
    
    // Guardar PDF
    doc.save(`Riesgo_Camaras_${currentDate.replace(/-/g, '_')}.pdf`);
    
    console.log('PDF exportado exitosamente');
}
