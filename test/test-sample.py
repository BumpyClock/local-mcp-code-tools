#!/usr/bin/env python3
"""
Test sample Python file for MCP testing
"""

def calculate_factorial(n):
    """Calculate the factorial of a number."""
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    
    result = 1
    for i in range(1, n + 1):
        result *= i
    
    return result

def fibonacci(n):
    """Generate the Fibonacci sequence up to n terms."""
    sequence = []
    a, b = 0, 1
    
    for _ in range(n):
        sequence.append(a)
        a, b = b, a + b
    
    return sequence

if __name__ == "__main__":
    print(f"Factorial of 5: {calculate_factorial(5)}")
    print(f"First 10 Fibonacci numbers: {fibonacci(10)}")
