/**
 * Complex sample file with issues for testing code review
 */

// Global variable - not ideal
let counter = 0;

// Function with potential issues
function processData(data) {
  // No input validation
  counter++;
  
  // Inefficient loop
  for (let i = 0; i < data.length; i++) {
    data[i] = data[i] * 2;
  }
  
  // Potential security issue with eval
  const result = eval(data.join('+'));
  
  return result;
}

// Function with unused parameters
function formatResult(result, options, config, unused) {
  return `Result: ${result}`;
}

// Callback hell example
function fetchData(url, callback) {
  setTimeout(() => {
    const data = [1, 2, 3, 4, 5];
    callback(data, (processedData) => {
      setTimeout(() => {
        const formattedResult = formatResult(processedData);
        setTimeout(() => {
          console.log(formattedResult);
        }, 100);
      }, 100);
    });
  }, 100);
}

// Export the functions
module.exports = {
  processData,
  formatResult,
  fetchData,
};
