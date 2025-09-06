export type CodeExample = {
    name: string;
    code: string;
    boring?: boolean;
}


// TODO: improve examples to be simpler and to demonstrate individual concepts. 
// right now, I'm just using this mechanism to save and load various scenarios.
export const CODE_EXAMPLES: CodeExample[] = [
    {
        name: "Large text",
        code: 
        `as;f;askdf;lasdfkdjfajd;ak;jf\n`.repeat(1000),
    },
    {
        name: "Plotting",
        code:
        // TODO: sound output, sound looping
            `
// Creating a square wave from multiple sine waves

harmonics = slider("harmonics", 5, 70, 1)
harmonic_offset = slider("harmonic_offset", 1, 10, 1)

samples = list[]
dt = 440 * 1 / 48000
for t in range(0, 2*PI, dt) {
	sample = 0
	magnitude = 0
	
	for harmonic in range(1, harmonics * harmonic_offset, harmonic_offset) {	
		m = 1 / harmonic
		sample = sample + (
			m * (2 * sin(t * harmonic) - 1)
		)
		magnitude = magnitude + m
	}

	push(samples, [t, sample / magnitude])
}

plot_lines(1, samples)
`
    },
    {
        name: "Signed distance fields",
        code: `
// Try increasing this, if your PC allows for it 
set_heatmap_subdiv(40)

heatmap(1, sdf(a, b) { 
    radius = 0.2
    thickness = 0.03
    sqrt(a*a + b*b) 
    (radius - thickness) < ^ && ^ < (radius + thickness)
}, [0.5, 0, 0])

heatmap(1, sdf2(a, b) { 
    radius = 0.3
    thickness = 0.03
    sqrt(a*a + b*b) 
    (radius - thickness) < ^ && ^ < (radius + thickness)
}, "#F00")

plot_points(1, 0.5 * [
    [0, 0],
    [1, 0], 
    [-1, 0],
    [0, 1],
    [0, -1],
])
`

    },
    {
        name: "Slider inputs",
        code: `
period = slider("period", 0, 100)
resolution = slider("resolution", 1, 100)

lines = list[]

one_over_res = 1 / resolution
for i in range(0, 100, one_over_res) {
    push(lines, [i, sin(i * period)])
}

plot_lines(1, lines)
        `
    },
    {
        name: "Images",
        code: `
seed = slider("seed", 0, 1000)

// rand_seed(now())
rand_seed(seed)

image([
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
    [rand(), rand(), rand(),rand(), rand(), rand(),rand(), rand(), rand()],
])

`
    },
    {
        name: "Graphs",
        code: `
g = map{}

for i in range(0, 10) {
    adj = list[]
    for j in range(0, 10) {
        push(adj, j)
    }

    g[i] = adj
}

graph(1, g)
`
    },
    {
        name: "Matrices",
        code: `

angle = slider("angle", 0, 2 * PI)

rot_matrix(a) {
    [[cos(a), -sin(a)],
     [sin(a), cos(a)]]
}

A = rot_matrix(angle)

plot_points(1, [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],

    mul(A, [0, 0.5]),
])

`
    },
    {
        name: "3D stuff",
        code: `
xAngle = slider("x", 0, 2 * PI)
yAngle = slider("y", 0, 2 * PI)
zAngle = slider("z", 0, 2 * PI)

X = rot3d_x(xAngle)
Y = rot3d_y(yAngle)
Z = rot3d_z(zAngle)

// Alternatively, you can do this:

// sinX = sin(xAngle)
// sinY = sin(yAngle)
// sinZ = sin(zAngle)
//
// cosX = cos(xAngle)
// cosY = cos(yAngle)
// cosZ = cos(zAngle)
//
// X =  [
//     [1,  0,  0, 0],
//     [0, cosX, -sinX, 0],
//     [0, sinX, cosX,  0],
//     [0,  0,  0, 1],
// ]
//
// Y = [
//     [cosY,  0,  -sinY, 0],
//     [0,    1, 0, 0],
//     [sinY, 0, cosY,  0],
//     [0,  0,  0, 1],
// ]
//
// Z = [
//     [cosZ, -sinZ, 0, 0],
//     [sinZ, cosZ,  0, 0],
//     [0,  0,  1, 0],
//     [0,  0,  0, 1],
// ]

T = mul(Z, mul(Y, mul(Z, X)))

point_cloud = list[]
for i in range(0, 100) {
    vec = [rand(), rand(), rand(), 1] -0.5
    vec[3]=1
    push(point_cloud, vec)
}
point_cloud = to_vec(point_cloud)

mul(point_cloud, T)
plot_points(1, ^)

x_axis = [[0, 0, 0, 0], [1, 0, 0, 1]]
mul(^, T)
plot_lines(1, ^, [1, 0, 0])

y_axis = [[0, 0, 0, 0], [0, 1, 0, 1]]
mul(^, T)
plot_lines(1, ^, [0, 1, 0])

z_axis = [[0, 0, 0, 0], [0, 0, 1, 1]]
mul(^, T)
plot_lines(1, ^, [0, 0, 1])

        `
    },
    {
        name: "Some more matrix.",
        code:
        `
pixelMatrix = [
	[100, 100, 10000, 100],
	[100, 100, 10000, 100],
	[100, 100, 10000, 100],
	[100, 100, 10000, 100],
]

val = [10, 10, 10, 10]

>>>mul(pixelMatrix, val)
>>>mul(pixelMatrix, ^)
>>>mul(pixelMatrix, ^)
>>>mul(pixelMatrix, ^)
>>>mul(pixelMatrix, ^) 
>>>mul(pixelMatrix, ^)

val[0] = val[0] / val[3]
val[1] = val[1] / val[3]

>>> val
        `
    },
    {
        name: "Some more vector things",
        code:
        `
t = slider("t", 0, 6 * PI, 0.001)

dir = [sin(t), cos(t)]

a = [100, 200]

proj = dot(a, dir)

plot_points(0, [
	[0, 0],
	a,
	proj * dir,
	proj * a,
])

plot_lines(0, [
	[0, 0],
	1000 * dir
])

plot_lines(0, [
	-1000 * a,
	1000 * a
])

        `

    },
    {
        name: "Reshaping",
        boring: true,
        code:`
X = >>>[1, 2, 3]
Y = >>>reshape(X, [3, 1])
Z = >>>reshape(Y, [3])
`
    }
]
