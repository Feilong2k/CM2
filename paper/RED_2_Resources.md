# RED Analysis Part 2: Resource Mapping (Exhaustive)
**Target Paper:** *Attention Is All You Need* (Vaswani et al., 2017)

---

## **Resource Map for LEVEL 5: Atomic Primitives**

### **5.1.1. Action: GEMM (Matrix Multiplication) $C = AB$**
*   **Primary Resource:** **Compute (FLOPs)**
    *   Scale: $O(N^2 \cdot d)$ for Attention, $O(N \cdot d^2)$ for FFN.
    *   Dependency: Hardware Matrix Units (Tensor Cores).
*   **Secondary Resource:** **VRAM (Activation Storage)**
    *   Scale: $O(N^2)$ for Attention maps (dominant at long sequences), $O(N \cdot d)$ for FFN.
    *   *Constraint:* Quadratic memory scaling limits sequence length.

### **5.2.1. Action: Exponentiation ($e^x$) & 5.2.3. Division**
*   **Primary Resource:** **Special Function Units (SFUs)**
    *   Dependency: GPU SFU throughput (often lower than CUDA core throughput).
*   **Secondary Resource:** **Numerical Precision**
    *   Risk: Underflow/Overflow in fp16/bf16.

### **5.3.1. Action: Reduction Sum (Mean/Variance)**
*   **Primary Resource:** **Memory Bandwidth**
    *   Dependency: Reading full tensor to compute statistics.
    *   Bottleneck: LayerNorm is often bandwidth-bound, not compute-bound.

### **5.7.2. Action: Hash Map Update (BPE)**
*   **Primary Resource:** **CPU Memory**
    *   Scale: Vocabulary size vs Corpus size.
*   **Secondary Resource:** **Sequential Processing Time**
    *   Constraint: BPE merging is iterative (hard to parallelize fully).

---

## **Resource Map for LEVEL 4: Operational Logic**

### **4.1.2. Action: Compute Similarity Scores ($QK^T$)**
*   **Primary Resource:** **Interaction Context**
    *   Requirement: Must hold all $K$ vectors in memory to compute against $Q$.
    *   *Implicit Resource:* "Global view" of the sequence.

### **4.3.1. Action: Perform Matrix Multiplication ($xW + b$) (FFN)**
*   **Primary Resource:** **Parameter Memory**
    *   Scale: $2 \times d_{model} \times d_{ff}$ per layer.
    *   *Dominance:* FFNs consume ~66% of total Transformer parameters.

### **4.5.1. Action: Calculate Frequency Geometric Progression**
*   **Primary Resource:** **Representational Resolution**
    *   Constraint: Fixed wavelength spectrum (10000) limits position distinguishability at extreme lengths.

### **4.7.1. Action: Generate Bernoulli Mask (Dropout)**
*   **Primary Resource:** **RNG State**
    *   Dependency: Random seed synchronization across GPUs.

---

## **Resource Map for LEVEL 3: Architectural Logic**

### **3.3.2. Action: Define Multi-Head Wrapper**
*   **Primary Resource:** **Attention Heads**
    *   Quantity: $h=8$.
    *   Trade-off: Fragmentation of memory access (smaller matrices = lower arithmetic intensity).

### **3.1.2. Action: Implement Residual Connections**
*   **Primary Resource:** **Gradient Highway**
    *   Effect: Preserves signal magnitude during backprop.
    *   *Constraint:* Doubles memory traffic (read input + read residual).

### **3.8.1. Action: Distribute across GPUs**
*   **Primary Resource:** **Interconnect Bandwidth (NVLink/PCIe)**
    *   Requirement: All-reduce gradients ($~100MB$ per step).
    *   *Constraint:* Training speed bounded by slowest link.

---

## **Resource Map for LEVEL 2: High-Level Components**

### **2.2.1. Action: Prepare Data**
*   **Primary Resource:** **Bilingual Corpora**
    *   Quantity: 4.5M (DE), 36M (FR).
    *   Quality: High-alignment sentence pairs.
    *   *Gap:* No resource defined for "unsupervised" or "monolingual" learning (unlike later BERT/GPT).

### **2.1.1. Action: Design Encoder Stack**
*   **Primary Resource:** **Sequential Depth**
    *   Quantity: 6 layers.
    *   Constraint: Latency is linear with depth (cannot parallelize layers).

---

## **Critical Resource Bottlenecks (Synthesis)**

1.  **The FFN Parameter Sink:**
    *   *Source:* Action 4.3.1.
    *   *Insight:* Most "intelligence" (parameters) is in the point-wise FFNs, not the Attention. Attention is the router; FFN is the memory bank.

2.  **The Attention Memory Wall:**
    *   *Source:* Action 5.1.1.
    *   *Insight:* While parameters are in FFN, *activation memory* is dominated by Attention ($N^2$). This creates a split bottleneck: FFN limits model size, Attention limits context length.

3.  **The Bandwidth Tax:**
    *   *Source:* Actions 5.3.1 (Norm) + 3.1.2 (Residual).
    *   *Insight:* The architecture is heavy on element-wise ops and reductions (Norm, Add, Softmax), making it sensitive to memory bandwidth, not just raw FLOPs.
