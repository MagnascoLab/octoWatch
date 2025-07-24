import numpy as np
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from matplotlib.animation import FuncAnimation
import matplotlib.patches as patches

# Physical constants
G = 6.67430e-11  # Gravitational constant (m^3 kg^-1 s^-2)
AU = 1.496e11    # Astronomical unit (m)
M_sun = 1.989e30 # Solar mass (kg)
year = 365.25 * 24 * 3600  # seconds in a year

# Alpha Centauri system parameters
# Alpha Centauri A
m_A = 1.1 * M_sun
# Alpha Centauri B  
m_B = 0.91 * M_sun
# Proxima Centauri (C)
m_C = 0.12 * M_sun

# Initial conditions (simplified circular approximation)
# A-B binary separation: ~23 AU average
# Proxima orbits at ~13,000 AU (we'll use a closer orbit for visualization)
r_AB = 23 * AU
r_C = 100 * AU  # Scaled down for computational efficiency

def three_body_derivatives(t, state):
    """
    Calculate derivatives for the three-body problem.
    state = [x1, y1, x2, y2, x3, y3, vx1, vy1, vx2, vy2, vx3, vy3]
    """
    positions = state[:6].reshape(3, 2)
    velocities = state[6:].reshape(3, 2)
    
    masses = np.array([m_A, m_B, m_C])
    accelerations = np.zeros((3, 2))
    
    # Calculate gravitational forces between all pairs
    for i in range(3):
        for j in range(3):
            if i != j:
                r_vec = positions[j] - positions[i]
                r_mag = np.linalg.norm(r_vec)
                
                # Gravitational acceleration
                a_mag = G * masses[j] / r_mag**2
                accelerations[i] += a_mag * r_vec / r_mag
    
    # Return derivatives [velocities, accelerations]
    return np.concatenate([velocities.flatten(), accelerations.flatten()])

def setup_initial_conditions(perturbation=0):
    """
    Set up initial conditions with optional perturbation.
    """
    # Place A at origin, B on x-axis
    pos_A = np.array([0.0, 0.0])
    pos_B = np.array([r_AB, 0.0])
    
    # Place C in a wider orbit
    angle_C = np.random.uniform(0, 2*np.pi) if perturbation > 0 else 0
    pos_C = np.array([r_C * np.cos(angle_C), r_C * np.sin(angle_C)])
    
    # Calculate orbital velocities (circular approximation)
    # A-B binary
    v_AB = np.sqrt(G * (m_A + m_B) / r_AB)
    vel_A = np.array([0, -v_AB * m_B / (m_A + m_B)])
    vel_B = np.array([0, v_AB * m_A / (m_A + m_B)])
    
    # C's velocity (treating A-B as single mass)
    v_C = np.sqrt(G * (m_A + m_B + m_C) / r_C)
    vel_C = np.array([-v_C * np.sin(angle_C), v_C * np.cos(angle_C)])
    
    # Add perturbations
    if perturbation > 0:
        pos_A += np.random.normal(0, perturbation * AU, 2)
        pos_B += np.random.normal(0, perturbation * AU, 2)
        pos_C += np.random.normal(0, perturbation * AU, 2)
        
        vel_A += np.random.normal(0, perturbation * 1000, 2)  # m/s
        vel_B += np.random.normal(0, perturbation * 1000, 2)
        vel_C += np.random.normal(0, perturbation * 1000, 2)
    
    return np.concatenate([pos_A, pos_B, pos_C, vel_A, vel_B, vel_C])

def calculate_planet_position(star_positions, planet_distance=0.1*AU):
    """
    Calculate a hypothetical planet position given the three stars.
    Places planet in the barycenter frame at a fixed distance.
    """
    masses = np.array([m_A, m_B, m_C])
    barycenter = np.average(star_positions, weights=masses, axis=0)
    
    # Simple model: planet orbits the barycenter
    angle = np.random.uniform(0, 2*np.pi)
    planet_pos = barycenter + planet_distance * np.array([np.cos(angle), np.sin(angle)])
    
    return planet_pos

def monte_carlo_simulation(n_simulations=10, t_years=50, perturbation=1e-6):
    """
    Run Monte Carlo simulations with slight perturbations.
    """
    t_span = (0, t_years * year)
    t_eval = np.linspace(0, t_years * year, 1000)
    
    trajectories = []
    
    print(f"Running {n_simulations} simulations...")
    
    # Reference trajectory (no perturbation)
    initial_state = setup_initial_conditions(perturbation=0)
    sol_ref = solve_ivp(three_body_derivatives, t_span, initial_state, 
                        t_eval=t_eval, method='DOP853', rtol=1e-10, atol=1e-12)
    
    # Perturbed trajectories
    for i in range(n_simulations):
        initial_state = setup_initial_conditions(perturbation=perturbation)
        sol = solve_ivp(three_body_derivatives, t_span, initial_state, 
                       t_eval=t_eval, method='DOP853', rtol=1e-10, atol=1e-12)
        trajectories.append(sol)
        
        if (i + 1) % 5 == 0:
            print(f"  Completed {i + 1}/{n_simulations} simulations")
    
    return sol_ref, trajectories, t_eval

def analyze_divergence(sol_ref, trajectories, t_eval):
    """
    Analyze how prediction errors grow over time.
    """
    n_points = len(t_eval)
    n_sims = len(trajectories)
    
    # Calculate position differences for each star
    divergences = np.zeros((n_sims, n_points, 3))  # 3 stars
    
    for i, sol in enumerate(trajectories):
        for t_idx in range(n_points):
            for star_idx in range(3):
                ref_pos = sol_ref.y[2*star_idx:2*star_idx+2, t_idx]
                sim_pos = sol.y[2*star_idx:2*star_idx+2, t_idx]
                divergences[i, t_idx, star_idx] = np.linalg.norm(ref_pos - sim_pos)
    
    # Calculate mean and std of divergences
    mean_divergence = np.mean(divergences, axis=0)
    std_divergence = np.std(divergences, axis=0)
    
    return mean_divergence, std_divergence

def plot_results(t_eval, mean_divergence, std_divergence, sol_ref):
    """
    Create visualization of the results.
    """
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
    
    # Convert time to years
    t_years = t_eval / year
    
    # Plot 1: Divergence over time (log scale)
    ax1.set_yscale('log')
    colors = ['red', 'blue', 'green']
    labels = ['Alpha Centauri A', 'Alpha Centauri B', 'Proxima Centauri']
    
    for i in range(3):
        ax1.plot(t_years, mean_divergence[:, i] / AU, color=colors[i], 
                label=labels[i], linewidth=2)
        ax1.fill_between(t_years, 
                        (mean_divergence[:, i] - std_divergence[:, i]) / AU,
                        (mean_divergence[:, i] + std_divergence[:, i]) / AU,
                        color=colors[i], alpha=0.3)
    
    ax1.set_xlabel('Time (years)')
    ax1.set_ylabel('Position Error (AU)')
    ax1.set_title('Growth of Prediction Errors in Alpha Centauri System')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Add horizontal lines for reference
    ax1.axhline(y=0.1, color='gray', linestyle='--', alpha=0.5, 
                label='0.1 AU (Venus orbit)')
    ax1.axhline(y=1.0, color='gray', linestyle='--', alpha=0.5, 
                label='1 AU (Earth orbit)')
    
    # Plot 2: Sample trajectory
    ax2.set_aspect('equal')
    
    # Plot star trajectories
    for i, (color, label) in enumerate(zip(colors, labels)):
        x = sol_ref.y[2*i, ::10] / AU  # Downsample for clarity
        y = sol_ref.y[2*i+1, ::10] / AU
        ax2.plot(x, y, color=color, alpha=0.7, linewidth=1, label=label)
        
        # Mark initial positions
        ax2.scatter(sol_ref.y[2*i, 0] / AU, sol_ref.y[2*i+1, 0] / AU, 
                   color=color, s=100, marker='o', edgecolor='black', linewidth=2)
    
    ax2.set_xlabel('X Position (AU)')
    ax2.set_ylabel('Y Position (AU)')
    ax2.set_title('Sample Three-Body Trajectories')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('trisolaran_chaos.png', dpi=300, bbox_inches='tight')
    plt.show()

def calculate_predictability_horizon(mean_divergence, t_eval, threshold_au=1.0):
    """
    Calculate when predictions become unreliable (exceed threshold).
    """
    t_years = t_eval / year
    horizons = []
    
    for star_idx in range(3):
        # Find when error exceeds threshold
        idx = np.where(mean_divergence[:, star_idx] / AU > threshold_au)[0]
        if len(idx) > 0:
            horizons.append(t_years[idx[0]])
        else:
            horizons.append(t_years[-1])
    
    return horizons

# Run the simulation
if __name__ == "__main__":
    print("Simulating the Trisolaran Three-Body Problem...")
    print("Initial perturbation: 1 km in position, 1 mm/s in velocity")
    
    # Run Monte Carlo simulations
    sol_ref, trajectories, t_eval = monte_carlo_simulation(
        n_simulations=20, 
        t_years=100, 
        perturbation=1e-6  # Very small perturbation
    )
    
    # Analyze divergence
    mean_div, std_div = analyze_divergence(sol_ref, trajectories, t_eval)
    
    # Calculate predictability horizons
    horizons = calculate_predictability_horizon(mean_div, t_eval, threshold_au=1.0)
    
    print("\nPredictability Horizons (1 AU error threshold):")
    print(f"  Alpha Centauri A: {horizons[0]:.1f} years")
    print(f"  Alpha Centauri B: {horizons[1]:.1f} years")
    print(f"  Proxima Centauri: {horizons[2]:.1f} years")
    
    # For a planet at 0.1 AU from barycenter
    planet_horizons = calculate_predictability_horizon(mean_div, t_eval, threshold_au=0.01)
    print("\nFor a planet (0.01 AU error threshold):")
    print(f"  Prediction horizon: {min(planet_horizons):.1f} years")
    
    # Plot results
    plot_results(t_eval, mean_div, std_div, sol_ref)
    
    print("\nSimulation complete! See 'trisolaran_chaos.png' for visualization.")