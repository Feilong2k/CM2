# Math for AI: Phase 3 - Architecture Mathematics

**Note:** This document contains Phase 3 only. Students see this after completing Phase 2 successfully.

## 🏗️ Phase 3: Architecture Understanding (4-6 weeks)

### **Goal:** Connect mathematical concepts to AI architecture design decisions

---

## Week 13-14: CNN Mathematics

### **Project:** Reimplement ResNet Block from Paper

#### **Key Mathematical Concepts:**
- **Convolution as cross-correlation:** `(f ∗ g)[n] = Σ f[m]·g[n-m]`
- **Pooling as dimensionality reduction:** Max/Average pooling operations
- **Spatial hierarchies:** How features combine across layers
- **Skip connections:** Solving vanishing gradient problem

#### **Architecture Insight:**
- Why 3x3 convolutions are standard
- How receptive fields grow through layers
- Batch normalization as distribution stabilization

#### **Practical Application:**
- Implement ResNet-18 block from scratch
- Train on CIFAR-10 dataset
- Visualize feature maps at different layers

#### **Success Metric:**
- Your implementation matches paper performance (±2%)
- Can explain why residual connections improve training
- Visualize how features become more abstract through layers

#### **Math-to-Architecture Connection:**
```
Input → Conv → BatchNorm → ReLU → Conv → BatchNorm → Add → ReLU → Output
      ↑                                    ↓
      └────────────────────────────────────┘
            Skip Connection (Identity)
```

---

## Week 15-16: RNN/LSTM Mathematics

### **Project:** Implement LSTM Cell from Scratch

#### **Key Mathematical Concepts:**
- **Recurrence equations:** `h_t = f(h_{t-1}, x_t)`
- **Gating mechanisms:** Forget/Input/Output gates as learned filters
- **Backpropagation Through Time (BPTT):** Gradient flow across sequences
- **Vanishing/Exploding gradients:** Why LSTMs help

#### **Architecture Insight:**
- How gates control information flow
- Cell state vs hidden state distinction
- Parameter sharing across time steps

#### **Practical Application:**
- Build character-level language model
- Generate Shakespeare-style text
- Visualize gate activations over time

#### **Success Metric:**
- Model generates coherent paragraphs
- Can explain what each gate learns to do
- Understand tradeoffs between RNN/LSTM/GRU

#### **Visual Learning:**
- Animated LSTM cell showing gate operations
- Gradient flow visualization through time
- Attention-like visualization of important time steps

---

## Week 17-18: Transformer Mathematics

### **Project:** Build Mini-Transformer from "Attention Is All You Need"

#### **Key Mathematical Concepts:**
- **Self-attention:** `Attention(Q,K,V) = softmax(QK^T/√d_k)V`
- **Positional encodings:** `PE(pos,2i) = sin(pos/10000^{2i/d})`
- **Multi-head attention:** Parallel attention mechanisms
- **Layer normalization:** Stabilizing training dynamics

#### **Architecture Insight:**
- Why attention replaces recurrence
- How positional encodings provide sequence information
- The role of feed-forward networks in transformers

#### **Practical Application:**
- Implement encoder-decoder transformer
- Train on translation task (small dataset)
- Visualize attention heatmaps for different heads

#### **Success Metric:**
- Model learns simple translation patterns
- Can explain what each attention head specializes in
- Understand computational complexity tradeoffs

#### **Math Deep Dive:**
```
Scaled Dot-Product Attention:
1. QK^T → similarity matrix
2. /√d_k → scale for stable gradients  
3. softmax → attention weights
4. ×V → weighted sum of values
```

---

## 🎯 Phase 3 Completion Criteria

### **You're ready for Phase 4 when you can:**
1. Implement any standard architecture from a research paper
2. Explain architectural choices mathematically (why 3x3 conv? why softmax in attention?)
3. Modify an architecture to solve a new problem type
4. Read architecture papers and understand the mathematical motivations

### **Projects Portfolio:**
- ResNet implementation with skip connections
- LSTM language model with gate visualization
- Transformer with multi-head attention
- Architecture comparison report

### **Architectural Intuition Developed:**
- **CNN:** Spatial hierarchy, translation invariance
- **RNN/LSTM:** Sequential dependencies, memory
- **Transformer:** Global dependencies, parallel processing

### **Next Steps:**
After Phase 3, you'll unlock **Phase 4: Architecture Adaptation** where you'll modify and create novel architectures.

---

## 💡 Learning Strategy for Phase 3

### **1. Paper-to-Code Translation:**
- Start with architecture diagram from paper
- Translate each component to mathematical operations
- Implement, test, debug, understand

### **2. Ablation Studies:**
- Remove skip connections → see performance drop
- Remove layer norm → observe training instability
- Change attention heads → analyze effect

### **3. Visualization at Every Layer:**
- CNN: Feature map visualizations
- LSTM: Gate activation patterns  
- Transformer: Attention heatmaps

### **4. Mathematical Justification:**
- For every architectural choice, ask "why this math?"
- Connect operations to mathematical properties
- Understand tradeoffs in equation form

---

**Remember:** You now have the mathematical foundation to understand WHY architectures work, not just HOW to use them. This is the transition from AI user to AI architect.