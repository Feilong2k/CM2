# Math for AI: Phase 2 - Core AI Mathematics

**Note:** This document contains Phase 2 only. Students see this after completing Phase 1 successfully.

## 📊 Phase 2: Core AI Math (4-8 weeks)

### **Goal:** Understand the mathematical foundations of modern AI architectures

---

## Week 5-6: Probability & Statistics for AI

### **Project:** Build a Bayesian Spam Classifier

#### **Key Concepts:**
- **Probability distributions** (Gaussian for weight initialization)
- **Bayes' theorem** for inference and classification
- **Maximum Likelihood Estimation (MLE)** for parameter learning
- **Conditional probability** for feature relationships

#### **Practical Application:**
- Implement Naive Bayes classifier from scratch
- Use real email dataset (Enron or similar)
- Visualize probability distributions of spam vs ham words

#### **Success Metric:**
- Classifier achieves >90% accuracy on test set
- Can explain why certain words indicate spam probabilistically
- Understand tradeoffs between precision and recall

#### **Math-to-Code Connection:**
```python
# Bayes' theorem in action
P(spam|word) = P(word|spam) * P(spam) / P(word)
```

---

## Week 7-10: Optimization Theory

### **Project:** Optimization Algorithm Benchmark

#### **Key Concepts:**
- **Convex vs non-convex optimization** (why neural networks are hard)
- **Gradient descent variants:** SGD, Momentum, RMSProp, Adam
- **Learning rate schedules:** Step decay, cosine annealing
- **Loss landscapes** and saddle points

#### **Practical Application:**
- Implement 5 optimization algorithms from scratch
- Benchmark on MNIST dataset
- Visualize loss landscapes for different optimizers

#### **Success Metric:**
- Adam optimizer converges fastest
- Can explain why momentum helps escape local minima
- Understand learning rate sensitivity

#### **Visual Learning:**
- Animated gradient descent on 2D loss surfaces
- Parameter trajectory visualizations
- Loss curve comparisons

---

## Week 11-12: Information Theory

### **Project:** Simple Transformer Attention Mechanism

#### **Key Concepts:**
- **Entropy** as uncertainty measure
- **KL Divergence** for distribution matching
- **Mutual Information** for feature selection
- **Cross-entropy** as loss function

#### **Practical Application:**
- Implement self-attention mechanism
- Build character-level language model
- Visualize attention heatmaps

#### **Success Metric:**
- Model generates coherent text sequences
- Attention focuses on semantically relevant words
- Understand information flow through layers

#### **Math Insight:**
- Attention weights as information allocation
- Softmax as probability distribution over inputs
- Query-Key matching as information retrieval

---

## 🎯 Phase 2 Completion Criteria

### **You're ready for Phase 3 when you can:**
1. Explain why Gaussian distributions are used for weight initialization
2. Implement Adam optimizer from scratch and explain each component
3. Calculate mutual information between features in a dataset
4. Read an optimization research paper and understand the claims

### **Projects Portfolio:**
- Bayesian classifier with >90% accuracy
- Optimization benchmark with visual comparisons
- Attention-based language model
- Technical blog post explaining one concept

### **Next Steps:**
After Phase 2, you'll unlock **Phase 3: Architecture Mathematics** where we connect these concepts to CNN, RNN, and Transformer architectures.

---

## 💡 Learning Strategy for Phase 2

### **1. Concept Mapping:**
- Create visual maps connecting probability → optimization → information theory
- Link each concept to specific AI architecture components

### **2. Implementation First:**
- Start with working code (even if copied)
- Break it, debug it, understand the math through failure
- Add visualization at every step

### **3. Progressive Complexity:**
- Week 5: 1D probability distributions
- Week 7: 2D optimization surfaces  
- Week 11: N-dimensional information measures

### **4. Real-World Connections:**
- How Spotify uses probability for recommendations
- How Google uses optimization for ad placement
- How GPT uses information theory for text generation

---

**Remember:** You earned this phase by mastering Phase 1. The math that seemed abstract now has concrete AI applications. Each week builds directly on what you've already accomplished.