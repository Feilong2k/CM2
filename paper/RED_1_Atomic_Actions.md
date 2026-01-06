# RED Analysis Part 1: Atomic Actions Decomposition (Exhaustive)
**Target Paper:** *Attention Is All You Need* (Vaswani et al., 2017)

---

## **LEVEL 1: Core Methodology (The Actions Taken)**
*   **1.1. Construct Model Architecture**
*   **1.2. Train Model**
*   **1.3. Evaluate Model**

---

## **LEVEL 2: High-Level Components (Decomposition of Level 1)**

### **From 1.1: Construct Model Architecture**
*   **2.1.1. Design Encoder Stack**
*   **2.1.2. Design Decoder Stack**
*   **2.1.3. Design Attention Mechanism**
*   **2.1.4. Design Position-wise Feed-Forward Networks**
*   **2.1.5. Design Embeddings and Softmax**
*   **2.1.6. Design Positional Encoding**

### **From 1.2: Train Model**
*   **2.2.1. Prepare Data**
*   **2.2.2. Configure Hardware**
*   **2.2.3. Configure Optimizer**
*   **2.2.4. Apply Regularization**

### **From 1.3: Evaluate Model**
*   **2.3.1. Evaluate Machine Translation (WMT 2014)**
*   **2.3.2. Evaluate Model Variations**
*   **2.3.3. Evaluate English Constituency Parsing**

---

## **LEVEL 3: Architectural Logic (Decomposition of Level 2)**

### **From 2.1.1: Design Encoder Stack**
*   **3.1.1. Stack Identity Layers** (Repeat N=6 times)
*   **3.1.2. Implement Residual Connections** (Add input to output)
*   **3.1.3. Implement Layer Normalization** (Normalize after residual)

### **From 2.1.2: Design Decoder Stack**
*   **3.2.1. Stack Identity Layers** (Repeat N=6 times)
*   **3.2.2. Insert Masked Self-Attention Sub-layer**
*   **3.2.3. Insert Encoder-Decoder Attention Sub-layer**
*   **3.2.4. Implement Residual Connections**
*   **3.2.5. Implement Layer Normalization**

### **From 2.1.3: Design Attention Mechanism**
*   **3.3.1. Define Scaled Dot-Product Attention** (The core kernel)
*   **3.3.2. Define Multi-Head Wrapper** (Parallel projection)

### **From 2.1.4: Design Position-wise Feed-Forward Networks**
*   **3.4.1. Define Linear Transformation 1** (Expansion)
*   **3.4.2. Define Activation Function** (ReLU)
*   **3.4.3. Define Linear Transformation 2** (Contraction)

### **From 2.1.5: Design Embeddings and Softmax**
*   **3.5.1. Define Input/Output Embeddings**
*   **3.5.2. Define Linear Pre-Softmax Transformation**
*   **3.5.3. Share Weights** (Between embeddings and pre-softmax)
*   **3.5.4. Scale Weights** (Multiply by $\sqrt{d_{model}}$)

### **From 2.1.6: Design Positional Encoding**
*   **3.6.1. Select Sinusoidal Functions**
*   **3.6.2. Add Encoding to Embeddings**

### **From 2.2.1: Prepare Data**
*   **3.7.1. Encode Vocabulary (BPE)**
*   **3.7.2. Batch Sentence Pairs**

### **From 2.2.2: Configure Hardware**
*   **3.8.1. Distribute across GPUs**
*   **3.8.2. Define Training Schedule** (Steps/Time)

### **From 2.2.3: Configure Optimizer**
*   **3.9.1. Select Adam Algorithm**
*   **3.9.2. Define Learning Rate Schedule** (Warmup + Decay)

### **From 2.2.4: Apply Regularization**
*   **3.10.1. Apply Residual Dropout**
*   **3.10.2. Apply Label Smoothing**

---

## **LEVEL 4: Operational Logic (Decomposition of Level 3)**

### **From 3.3.1: Define Scaled Dot-Product Attention**
*   **4.1.1. Project inputs to Q, K, V** (Implicit in Multi-Head, explicit here as inputs)
*   **4.1.2. Compute Similarity Scores ($QK^T$)**
*   **4.1.3. Scale Scores ($1/\sqrt{d_k}$)**
*   **4.1.4. Mask Scores (Optional)** (Set to $-\infty$)
*   **4.1.5. Normalize Scores (Softmax)**
*   **4.1.6. Aggregate Values (Weighted Sum)**

### **From 3.3.2: Define Multi-Head Wrapper**
*   **4.2.1. Project Inputs $h$ times** (Linear $W_Q, W_K, W_V$)
*   **4.2.2. Run Attention in Parallel**
*   **4.2.3. Concatenate Outputs**
*   **4.2.4. Project Final Output** (Linear $W_O$)

### **From 3.4.1/3.4.3: Define Linear Transformations (FFN)**
*   **4.3.1. Perform Matrix Multiplication ($xW + b$)**
*   **4.3.2. Broadcast across positions** (Same weights for all positions)

### **From 3.1.3/3.2.5: Implement Layer Normalization**
*   **4.4.1. Compute Mean and Variance**
*   **4.4.2. Normalize**
*   **4.4.3. Scale and Shift** (Learnable parameters)

### **From 3.6.1: Select Sinusoidal Functions**
*   **4.5.1. Calculate Frequency Geometric Progression**
*   **4.5.2. Apply Sine to Even Indices**
*   **4.5.3. Apply Cosine to Odd Indices**

### **From 3.7.1: Encode Vocabulary (BPE)**
*   **4.6.1. Initialize Vocabulary** (Characters)
*   **4.6.2. Count Symbol Pairs**
*   **4.6.3. Merge Most Frequent Pair**
*   **4.6.4. Repeat until Target Size**

### **From 3.10.1: Apply Residual Dropout**
*   **4.7.1. Generate Bernoulli Mask**
*   **4.7.2. Element-wise Multiplication**

---

## **LEVEL 5: Atomic Primitives (Decomposition of Level 4)**

### **From 4.1.2 / 4.3.1: Matrix Multiplication**
*   **5.1.1. GEMM (General Matrix Multiply)**
    *   *Action:* $C = AB$. The fundamental compute unit.

### **From 4.1.5: Softmax**
*   **5.2.1. Exponentiation ($e^x$)**
*   **5.2.2. Summation ($\sum$)**
*   **5.2.3. Division ($/$)**

### **From 4.4.1: Compute Mean/Variance**
*   **5.3.1. Reduction Sum**
*   **5.3.2. Division by Dimension**
*   **5.3.3. Subtraction (Centered Mean)**
*   **5.3.4. Square**

### **From 4.1.3 / 3.5.4: Scaling**
*   **5.4.1. Scalar Multiplication/Division**

### **From 4.5.2 / 4.5.3: Trigonometric Functions**
*   **5.5.1. Sine Calculation**
*   **5.5.2. Cosine Calculation**

### **From 4.7.1: Bernoulli Mask**
*   **5.6.1. Pseudo-Random Number Generation**
*   **5.6.2. Thresholding**

### **From 4.6.2: Count Symbol Pairs**
*   **5.7.1. String Iteration**
*   **5.7.2. Hash Map Update** (Frequency counting)
