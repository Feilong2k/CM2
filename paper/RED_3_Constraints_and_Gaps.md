# RED Analysis Part 3: Constraints, Assumptions & Gaps (Exhaustive)
**Target Paper:** *Attention Is All You Need* (Vaswani et al., 2017)

---

## **Goal:** Synthesize the hidden boundaries (Constraints), unstated premises (Assumptions), and missing components (Gaps) revealed by the exhaustive decomposition.

---

## **1. Constraints Analysis (The "Walls")**

### **1.1. The Memory Wall (Activation Storage)**
*   **Source:** Action 5.1.1 (GEMM $QK^T$).
*   **Constraint:** Storing the $N \times N$ attention matrix dominates memory at long sequence lengths.
*   **Implication:** Context length $N$ is hard-capped by VRAM capacity ($O(N^2)$). This is the "original sin" of the Transformer.

### **1.2. The Latency Floor (Sequential Depth)**
*   **Source:** Action 2.1.1 (Stack Identity Layers) + Action 3.1.1 (Repeat N=6).
*   **Constraint:** Layers are sequential dependencies. You cannot compute Layer $i+1$ until Layer $i$ is done.
*   **Implication:** Inference latency is linear with depth ($O(L)$). Unlike RNNs (linear with length), Transformers are constant with length (parallel), but linear with depth.

### **1.3. The Bandwidth Tax (Normalization Overhead)**
*   **Source:** Action 5.3.1 (Reduction Sum/Mean).
*   **Constraint:** LayerNorm and Residual Add are memory-bandwidth bound, not compute-bound.
*   **Implication:** On modern GPUs, a significant % of time is spent just moving data for Norms/Adds, not doing "useful" matrix math.

### **1.4. The Fixed Resolution Constraint**
*   **Source:** Action 4.5.1 (Frequency Geometric Progression).
*   **Constraint:** The positional encoding spectrum (10k max wavelength) creates a "soft limit" on resolution.
*   **Implication:** Extrapolating beyond training length fails not just because of attention patterns, but because the frequency basis functions become indistinguishable or aliased.

---

## **2. Assumptions Analysis (The "Unstated Premises")**

### **2.1. The "Static World" Assumption**
*   **Premise:** Training data (WMT 2014) is a sufficient proxy for the distribution of all future tasks.
*   **Reality:** Weights are frozen (Action 2.2.3). The model assumes the world distribution is stationary. It cannot adapt to new vocabulary or concepts post-training without re-training.

### **2.2. The "Loss Proxy" Assumption**
*   **Premise:** Minimizing Cross-Entropy (Action 2.2.3) on next-token prediction leads to semantic understanding.
*   **Reality:** It leads to statistical mimicry. The model assumes that "sounding right" (low perplexity) is equivalent to "being right" (truth), which is false for logical/factual tasks.

### **2.3. The "Permutation Invariance" Assumption**
*   **Premise:** The core Attention mechanism is set-based (permutation invariant). Order is *only* injected via Positional Encoding (Action 2.1.5).
*   **Reality:** This means the model has no inductive bias for sequence or hierarchy *except* what it can learn from the weak positional signal. This makes it data-hungry compared to RNNs/CNNs for local patterns.

---

## **3. Gaps & Missing Primitives (The "Unknown Unknowns")**

RED decomposition reveals what architectural primitives are simply **absent**.

### **Gap 1: The "Recurrent State" Primitive**
*   **Missing Action:** Update Persistent State.
*   **Observation:** The model has no "scratchpad" or "long-term memory" vector that persists across windows.
*   **Requirement:** A recurrent state (like CTM's $z_t$ or an RNN hidden state) to carry context beyond $N$.

### **Gap 2: The "Thinking Time" Primitive**
*   **Missing Action:** Dynamic Compute Loop.
*   **Observation:** The compute graph is static (fixed depth). Hard problems get the same FLOPs as easy problems.
*   **Requirement:** An internal loop (adaptive computation) to decouple *thinking time* from *input length*.

### **Gap 3: The "Grounding" Primitive**
*   **Missing Action:** Verify/Retrieve.
*   **Observation:** The model generates from internal weights (Action 4.3.1 FFN), not external facts.
*   **Requirement:** A primitive to "call out" to an external verifier or database (Retrieval-Augmented Generation).

---

## **4. The "Post-Transformer" Requirements**

Based on this analysis, the next-generation architecture must solve:
1.  **Quadratic Memory:** Replace $O(N^2)$ attention with $O(N)$ or $O(log N)$ mixing.
2.  **Static Weights:** Introduce plasticity or persistent state (Online Learning).
3.  **Fixed Depth:** Introduce adaptive recurrence (Thinking Time).
4.  **Ungrounded Generation:** Integrate verification loops natively.
